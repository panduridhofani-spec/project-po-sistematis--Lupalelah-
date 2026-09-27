import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { AppCard } from '../../../src/components/AppCard';
import { AppButton } from '../../../src/components/AppButton';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { Typography } from '../../../src/constants/Typography';
import { Spacing } from '../../../src/constants/Colors';
import { useTheme } from '../../../src/context/ThemeContext';
import { db } from '../../../src/lib/firebase';
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { PurchaseOrder, POItem } from '../../../src/types/stock';
import { ProductWithCategory } from '../../../src/types/master';
import { AppAlert } from '../../../src/components/AppAlert';

type SendInputState = Record<string, string>;

const parseStock = (val?: string | number) => {
  if (!val) return 0;
  const n = typeof val === 'number' ? val : parseFloat(val.replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

export default function LogisticsUrgentSendPOScreen() {
  const { id, from } = useLocalSearchParams<{ id: string, from?: string }>();
  const { colors, mode } = useTheme();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [productsMap, setProductsMap] = useState<Record<string, ProductWithCategory>>({});
  const [sendInputs, setSendInputs] = useState<SendInputState>({});
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [stockRecords, setStockRecords] = useState<Record<string, number>>({});
  
  // Urgent POs let Logistics choose who receives it
  const [targetShift, setTargetShift] = useState<number>(0); 
  const [targetDate, setTargetDate] = useState<string>('');

  useEffect(() => {
    fetchPODetail();
  }, [id]);

  const fetchPODetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const poDoc = await getDoc(doc(db, 'purchase_orders', id));
      if (!poDoc.exists()) {
        throw new Error('PO tidak ditemukan');
      }
      
      const poData = { id: poDoc.id, ...poDoc.data() } as PurchaseOrder;
      setPo(poData);

      if (poData.target_shift_number) setTargetShift(poData.target_shift_number);
      if (poData.target_operational_date) setTargetDate(poData.target_operational_date);
      else setTargetDate(poData.operational_date); // Default to current operational date

      // Fetch products for names and units
      const productsSnap = await getDocs(collection(db, 'products'));
      const pMap: Record<string, ProductWithCategory> = {};
      productsSnap.forEach(d => {
        pMap[d.id] = { id: d.id, ...d.data() } as ProductWithCategory;
      });
      setProductsMap(pMap);
      
      const initial: SendInputState = {};
      const noteInitial: Record<string, string> = {};
      poData.items.forEach(item => {
        initial[item.product_id] = (item.sent_quantity ?? item.requested_quantity).toString();
        noteInitial[item.product_id] = item.logistics_notes || '';
      });
      setSendInputs(initial);
      setNoteInputs(noteInitial);

      // Fetch the latest stock taking to know the Sisa Stok
      const stockQ = query(
        collection(db, 'stock_takings'),
        orderBy('taken_at', 'desc'),
        limit(1)
      );
      const stockSnap = await getDocs(stockQ);
      const stockMap: Record<string, number> = {};
      if (!stockSnap.empty) {
        stockSnap.docs[0].data().items?.forEach((i: any) => {
          stockMap[i.product_id] = i.actual_stock;
        });
      }
      setStockRecords(stockMap);

    } catch (error) {
      console.error('Error fetching PO detail:', error);
      AppAlert.show('Error', 'Gagal memuat detail PO');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInput = (productId: string, val: string) => {
    if (val !== '' && !/^[0-9.,]+$/.test(val)) return;
    setSendInputs(prev => ({ ...prev, [productId]: val }));
  };

  const handleUpdateNote = (productId: string, val: string) => {
    setNoteInputs(prev => ({ ...prev, [productId]: val }));
  };

  const handleIncrement = (productId: string) => {
    const current = parseStock(sendInputs[productId] || '0');
    setSendInputs(prev => ({ ...prev, [productId]: (current + 1).toString() }));
  };

  const handleDecrement = (productId: string) => {
    const current = parseStock(sendInputs[productId] || '0');
    if (current > 0) {
      setSendInputs(prev => ({ ...prev, [productId]: (current - 1).toString() }));
    }
  };

  const handleSave = async () => {
    if (!po) return;
    
    if (targetShift === 0) {
      AppAlert.show('Perhatian', 'Anda harus memilih Shift penerima untuk pesanan darurat ini.');
      return;
    }

    for (const item of po.items) {
      if (!sendInputs[item.product_id] || sendInputs[item.product_id] === '') {
        AppAlert.show('Perhatian', 'Semua jumlah kirim harus diisi. Masukkan 0 jika tidak mengirim barang tersebut.');
        return;
      }
    }
    
    setSaving(true);
    try {
      const updatedItems: POItem[] = po.items.map(item => ({
        ...item,
        sent_quantity: parseStock(sendInputs[item.product_id]),
        logistics_notes: noteInputs[item.product_id] || ''
      }));

      await updateDoc(doc(db, 'purchase_orders', po.id), {
        status: 'SENT',
        items: updatedItems,
        target_shift_number: targetShift,
        target_operational_date: targetDate,
        processed_at: new Date().toISOString()
      });

      AppAlert.show(
        'Berhasil', 
        'Barang Urgent berhasil dikirim. Menunggu validasi penerimaan dari Leader Shift tujuan.', 
        [{ text: 'OK', onPress: () => router.replace('/(logistics)/urgent-po') }]
      );
      
    } catch (error: any) {
      console.error('Error saving Urgent PO:', error);
      AppAlert.show('Error', 'Gagal memproses pengiriman barang.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !po) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: '#10131A' }]}>
        <ActivityIndicator size="large" color={'#D4AF37'} />
      </View>
    );
  }

  const isReadOnly = po.status === 'SENT' || po.status === 'VALIDATED' || po.status === 'COMPLETE';

  // UI Tokens for Premium Look
  const GOLD = colors.primary;
  const BG_DARK = colors.background;
  const RED_TEXT = colors.outOfStock;
  const GREEN_SAFE = colors.safe;
  const ORANGE_WARN = colors.warning;
  const CARD_BG = colors.surface;
  const BORDER_COLOR = colors.border;
  const TEXT_PRIMARY = colors.textPrimary;
  const TEXT_SECONDARY = colors.textSecondary;
  const MUTED = mode === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const MUTED_BORDER = mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const LIGHT_OPACITY = mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

  const getStatusColor = (item: POItem, prod: ProductWithCategory) => {
    const sisa = stockRecords[item.product_id] || 0;
    const sent = parseStock(sendInputs[item.product_id] || '0');
    const safe = prod?.safety_stock || 0;
    
    if (sendInputs[item.product_id] === '' || sent === 0) {
      if (sisa >= safe && safe > 0) return GREEN_SAFE; 
      return RED_TEXT;
    }
    if ((sisa + sent) >= safe) return GREEN_SAFE;
    return ORANGE_WARN;
  };

  const renderProductIcon = (name: string) => {
    const lower = name.toLowerCase();
    let iconName = 'package-variant';
    if (lower.includes('beras')) iconName = 'sack';
    else if (lower.includes('gula')) iconName = 'cube-outline';
    else if (lower.includes('minyak')) iconName = 'bottle-tonic-outline';
    else if (lower.includes('susu')) iconName = 'bottle-wine-outline';
    else if (lower.includes('kopi') || lower.includes('coffee')) iconName = 'coffee-outline';
    
    return <MaterialCommunityIcons name={iconName as any} size={48} color={MUTED} />;
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: BG_DARK }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => {
              if (from === 'history') {
                router.replace('/(logistics)/history');
              } else {
                router.back();
              }
            }} 
            style={styles.backButton} 
            disabled={saving}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={GOLD} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.screenTitle, { color: TEXT_PRIMARY, fontWeight: '300' }]}>Proses Urgent PO</Text>
            <Text style={[Typography.bodyMedium, { color: TEXT_SECONDARY }]}>
              UPO-{po.id.split('-')[0].toUpperCase()} • Oleh: {po.created_by_name || 'Leader Barista'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.statusPill, { borderColor: GOLD, backgroundColor: mode === 'dark' ? 'rgba(212, 175, 55, 0.1)' : 'rgba(212, 175, 55, 0.15)' }]}>
              <Text style={[styles.statusText, { color: GOLD }]}>Status: {po.status}</Text>
            </View>
            <TouchableOpacity style={{ marginLeft: 12 }}>
              <MaterialCommunityIcons name="cog-outline" size={24} color={GOLD} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginBottom: Spacing.m }}>
          <Text style={[Typography.labelSmall, { color: TEXT_SECONDARY, marginBottom: 4 }]}>PENGIRIM PESANAN</Text>
          <Text style={[Typography.bodyLarge, { color: TEXT_PRIMARY }]}>
            Shift {po.source_shift_number} ({po.operational_date})
          </Text>
        </View>

        {/* Target Shift Selector for Urgent PO */}
        <Text style={[Typography.cardTitle, { color: TEXT_PRIMARY, marginBottom: Spacing.s, marginTop: Spacing.l }]}>
          Tanggal Pengiriman
        </Text>
        <View style={styles.shiftSelector}>
          {[
            { label: 'Sesuai PO', date: po.operational_date },
            { 
              label: 'Hari Berikutnya', 
              date: (() => {
                const d = new Date(po.operational_date);
                d.setDate(d.getDate() + 1);
                return d.toISOString().split('T')[0];
              })()
            }
          ].map(item => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.shiftChip,
                { 
                  backgroundColor: targetDate === item.date ? 'rgba(212, 175, 55, 0.2)' : LIGHT_OPACITY,
                  borderColor: targetDate === item.date ? GOLD : MUTED_BORDER,
                  minWidth: '40%'
                }
              ]}
              onPress={() => !isReadOnly && !saving && setTargetDate(item.date)}
              disabled={isReadOnly || saving}
            >
              <Text style={[Typography.bodyMedium, { color: targetDate === item.date ? GOLD : TEXT_SECONDARY, fontWeight: 'bold' }]}>
                {item.label}
              </Text>
              <Text style={[Typography.bodySmall, { color: targetDate === item.date ? GOLD : TEXT_SECONDARY }]}>
                {item.date}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[Typography.cardTitle, { color: TEXT_PRIMARY, marginBottom: Spacing.s, marginTop: Spacing.m }]}>
          Pilih Shift Penerima
        </Text>
        <View style={styles.shiftSelector}>
          {[1, 2, 3, 4].map(shift => (
            <TouchableOpacity
              key={shift}
              style={[
                styles.shiftChip,
                { 
                  backgroundColor: targetShift === shift ? 'rgba(212, 175, 55, 0.2)' : LIGHT_OPACITY,
                  borderColor: targetShift === shift ? GOLD : MUTED_BORDER
                }
              ]}
              onPress={() => !isReadOnly && !saving && setTargetShift(shift)}
              disabled={isReadOnly || saving}
            >
              <Text style={[Typography.bodyMedium, { color: targetShift === shift ? GOLD : TEXT_SECONDARY }]}>Shift {shift}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[Typography.bodySmall, { color: TEXT_SECONDARY, marginBottom: Spacing.m }]}>
          * Barang Urgent dapat dikirimkan ke shift manapun.
        </Text>

        {isReadOnly && (
          <View style={{ backgroundColor: 'rgba(76, 175, 80, 0.1)', padding: Spacing.m, borderRadius: 8, marginTop: Spacing.xs, borderWidth: 1, borderColor: GREEN_SAFE }}>
            <Text style={{ color: GREEN_SAFE, fontWeight: 'bold' }}>PO ini sudah dikirim / divalidasi dan tidak dapat diubah lagi.</Text>
          </View>
        )}

        {po.has_discrepancy && (
          <View style={{ backgroundColor: colors.outOfStockLight || 'rgba(255, 107, 107, 0.1)', padding: Spacing.m, borderRadius: 8, borderWidth: 1, borderColor: RED_TEXT, marginBottom: Spacing.m, marginTop: Spacing.m }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={RED_TEXT} />
              <Text style={[Typography.bodyLarge, { color: RED_TEXT, marginLeft: 8 }]}>Terdapat Perbedaan Data</Text>
            </View>
            <Text style={[Typography.bodyMedium, { color: TEXT_PRIMARY }]}>
              {po.validation_notes || 'Barista melakukan perubahan jumlah barang masuk. Kemungkinan terdapat kesalahan input atau pengiriman dari pihak Logistik.'}
            </Text>
          </View>
        )}

        <Text style={[Typography.cardTitle, { color: TEXT_PRIMARY, marginBottom: Spacing.m, marginTop: Spacing.l }]}>
          Daftar Permintaan
        </Text>

        {po.items.map(item => {
          const prod = productsMap[item.product_id];
          const dynamicColor = getStatusColor(item, prod);
          return (
            <View key={item.product_id} style={[styles.premiumCard, { backgroundColor: CARD_BG, borderColor: isReadOnly ? MUTED_BORDER : dynamicColor, shadowColor: isReadOnly ? 'transparent' : dynamicColor }]}>
              <View style={styles.cardTopRow}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.m }}>
                    <Text style={[styles.productTitle, { color: TEXT_PRIMARY, marginBottom: 0 }]}>{prod?.name || 'Unknown'}</Text>
                  </View>
                  
                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <Text style={[styles.statLabel, { color: TEXT_SECONDARY }]}>SISA STOK OUTLET</Text>
                      <Text style={[styles.statValueRed, { color: RED_TEXT }]}>
                        {stockRecords[item.product_id] !== undefined ? stockRecords[item.product_id] : '?'} <Text style={{ fontSize: 14 }}>{prod?.unit}</Text>
                      </Text>
                    </View>
                    
                    <View style={styles.statBox}>
                      <Text style={[styles.statLabel, { color: TEXT_SECONDARY }]}>STOK AMAN</Text>
                      <Text style={[styles.statValueWhite, { color: TEXT_PRIMARY }]}>
                        {prod?.safety_stock !== undefined ? prod.safety_stock : '?'} <Text style={{ fontSize: 14 }}>{prod?.unit}</Text>
                      </Text>
                    </View>


                    {(po.status === 'VALIDATED' || po.status === 'COMPLETE') && (
                      <View style={styles.statBox}>
                        <Text style={[styles.statLabel, { color: TEXT_SECONDARY }]}>DITERIMA BARISTA</Text>
                        <Text style={[styles.statValueWhite, item.validated_quantity !== item.sent_quantity ? { color: RED_TEXT } : { color: TEXT_PRIMARY }]}>
                          {item.validated_quantity} <Text style={{ fontSize: 14 }}>{prod?.unit}</Text>
                        </Text>
                        {item.validated_quantity !== item.sent_quantity && (
                          <Text style={{ color: RED_TEXT, fontSize: 10, marginTop: 4 }}>
                            (Dikirim: {item.sent_quantity})
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.iconPlaceholder}>
                  {renderProductIcon(prod?.name || '')}
                </View>
              </View>

              {!isReadOnly && (
                <View style={styles.actionRow}>
                  <Text style={[styles.actionLabel, { color: TEXT_SECONDARY }]}>Akan Dikirim:</Text>
                  
                  <View style={[styles.glowingStepper, { backgroundColor: LIGHT_OPACITY, borderColor: dynamicColor, shadowColor: dynamicColor }]}>
                    <TouchableOpacity 
                      style={styles.stepperBtn}
                      onPress={() => handleDecrement(item.product_id)}
                      disabled={saving}
                    >
                      <MaterialCommunityIcons name="minus" size={24} color={dynamicColor} />
                    </TouchableOpacity>
                    
                    <TextInput
                      value={sendInputs[item.product_id] || ''}
                      onChangeText={(val) => handleUpdateInput(item.product_id, val)}
                      keyboardType="decimal-pad"
                      style={[styles.stepperInput, { color: dynamicColor }]}
                      editable={!saving}
                      placeholder="0"
                      placeholderTextColor={MUTED}
                    />
                    
                    <TouchableOpacity 
                      style={styles.stepperBtn}
                      onPress={() => handleIncrement(item.product_id)}
                      disabled={saving}
                    >
                      <MaterialCommunityIcons name="plus" size={24} color={dynamicColor} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              
              {/* Notes Input / Display */}
              {!isReadOnly ? (
                <View style={{ marginTop: Spacing.s }}>
                  <TextInput
                    value={noteInputs[item.product_id] || ''}
                    onChangeText={(val) => handleUpdateNote(item.product_id, val)}
                    placeholder="Tambah catatan (opsional, misal: Stok kosong di gudang)"
                    placeholderTextColor={MUTED}
                    style={[styles.noteInput, { backgroundColor: LIGHT_OPACITY, borderColor: MUTED_BORDER, color: TEXT_PRIMARY }]}
                    editable={!saving}
                    multiline
                  />
                </View>
              ) : item.logistics_notes ? (
                <View style={[styles.noteDisplay, { backgroundColor: LIGHT_OPACITY }]}>
                  <MaterialCommunityIcons name="information-outline" size={16} color={TEXT_SECONDARY} style={{ marginRight: 6 }} />
                  <Text style={[Typography.bodySmall, { color: TEXT_SECONDARY, flex: 1 }]}>
                    <Text style={{ fontWeight: 'bold' }}>Catatan Logistik:</Text> {item.logistics_notes}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}
        
      </ScrollView>

      {/* Sticky Bottom Save Button */}
      {!isReadOnly && (
        <View style={[styles.bottomBar, { backgroundColor: BG_DARK }]}>
          <TouchableOpacity 
            style={[styles.premiumButton, { backgroundColor: GOLD, borderColor: GOLD }]} 
            onPress={handleSave}
            disabled={saving}
          >
            <MaterialCommunityIcons name="truck-fast-outline" size={24} color="#000" style={{ marginRight: 8 }} />
            <Text style={styles.premiumButtonText}>
              {saving ? 'MEMPROSES...' : 'KIRIM BARANG (SENT)'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: Spacing.l, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.l, paddingTop: Platform.OS === 'ios' ? 40 : 20 },
  backButton: { marginRight: Spacing.m, padding: Spacing.xs },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  statusPill: { borderWidth: 1, borderColor: '#D4AF37', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: 'rgba(212, 175, 55, 0.1)' },
  statusText: { color: '#D4AF37', fontSize: 10, fontWeight: 'bold' },
  
  shiftSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.s, marginBottom: Spacing.s },
  shiftChip: { flex: 1, minWidth: '20%', paddingVertical: Spacing.m, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  
  premiumCard: {
    backgroundColor: '#181C25',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    padding: Spacing.m,
    marginBottom: Spacing.m,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.s },
  productTitle: { color: '#FFF', fontSize: 18, fontWeight: '600', marginBottom: Spacing.s },
  statsRow: { flexDirection: 'row', gap: Spacing.m },
  statBox: {},
  statLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValueRed: { color: '#FF6B6B', fontSize: 16, fontWeight: 'bold' },
  statValueWhite: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  iconPlaceholder: { justifyContent: 'center', alignItems: 'flex-end', opacity: 0.8 },
  
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.s },
  actionLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  
  glowingStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  stepperBtn: { padding: 6 },
  stepperInput: { minHeight: 32, width: 50, textAlign: 'center', fontSize: 18, fontWeight: 'bold', backgroundColor: 'transparent', borderWidth: 0, padding: 0 },
  
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.xl, paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xl },
  premiumButton: {
    borderWidth: 1,
    borderColor: '#D4AF37',
    borderRadius: 30,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D4AF37',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  premiumButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  
  noteInput: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 10,
    color: '#FFF',
    fontSize: 14,
    minHeight: 40,
    marginTop: 4
  },
  noteDisplay: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 8,
    borderRadius: 6,
    marginTop: Spacing.m,
    alignItems: 'flex-start'
  }
});
