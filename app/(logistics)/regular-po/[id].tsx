import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image, Modal, FlatList } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { AppCard } from '../../../src/components/AppCard';
import { AppButton } from '../../../src/components/AppButton';
import { AppTextInput } from '../../../src/components/AppTextInput';
import { TextInput } from 'react-native';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { Typography } from '../../../src/constants/Typography';
import { Spacing, Radius, Colors } from '../../../src/constants/Colors';
import { useTheme } from '../../../src/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../../../src/lib/firebase';
import { doc, getDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { PurchaseOrder, POItem } from '../../../src/types/stock';
import { ProductWithCategory } from '../../../src/types/master';
import { AppAlert } from '../../../src/components/AppAlert';

type SendInputState = Record<string, string>;

const parseStock = (val?: string | number) => {
  if (!val) return 0;
  const n = typeof val === 'number' ? val : parseFloat(val.replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

export default function LogisticsSendPOScreen() {
  const { id, from } = useLocalSearchParams<{ id: string, from?: string }>();
  const { colors, mode } = useTheme();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [showProductModal, setShowProductModal] = useState(false);
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [productsMap, setProductsMap] = useState<Record<string, ProductWithCategory>>({});
  const [sendInputs, setSendInputs] = useState<SendInputState>({});
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [stockRecords, setStockRecords] = useState<Record<string, number>>({});
  const [modalSearchQuery, setModalSearchQuery] = useState('');

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
      
      if (!poData.items || poData.items.length === 0) {
        const itemsQ = query(collection(db, 'purchase_order_items'), where('purchase_order_id', '==', id));
        const itemsSnap = await getDocs(itemsQ);
        poData.items = itemsSnap.docs.map(d => d.data() as any);
      }
      
      setPo(poData);

      // Fetch products for names and units
      const productsSnap = await getDocs(collection(db, 'products'));
      const pMap: Record<string, ProductWithCategory> = {};
      productsSnap.forEach(d => {
        pMap[d.id] = { id: d.id, ...d.data() } as ProductWithCategory;
      });
      setProductsMap(pMap);
      
      const draftKey = `draft_po_send_${id}`;
      const draftStr = await AsyncStorage.getItem(draftKey);
      let draftData: SendInputState | null = null;
      if (draftStr) {
        try { draftData = JSON.parse(draftStr); } catch (e) {}
      }
      
      const initial: SendInputState = {};
      const noteInitial: Record<string, string> = {};
      
      poData.items.forEach(item => {
        // Handle Send Inputs
        initial[item.product_id] = draftData && draftData.sendInputs && draftData.sendInputs[item.product_id] !== undefined 
          ? draftData.sendInputs[item.product_id] 
          : (draftData && draftData[item.product_id] !== undefined ? draftData[item.product_id] : (item.sent_quantity !== undefined ? item.sent_quantity.toString() : item.requested_quantity.toString()));
          
        // Handle Note Inputs
        noteInitial[item.product_id] = draftData && draftData.noteInputs && draftData.noteInputs[item.product_id] !== undefined
          ? draftData.noteInputs[item.product_id]
          : (item.logistics_notes ? item.logistics_notes : '');
      });
      
      setSendInputs(initial);
      setNoteInputs(noteInitial);

      // Fetch the actual stock taking data for this shift
      const stockQ = query(
        collection(db, 'stock_takings'),
        where('operational_date', '==', poData.operational_date),
        where('shift_number', '==', poData.source_shift_number)
      );
      const stockSnap = await getDocs(stockQ);
      const stockMap: Record<string, number> = {};
      
      if (!stockSnap.empty) {
        const stockData = stockSnap.docs[0].data();
        stockData.items?.forEach((i: any) => {
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

  // Helper to persist draft
  const saveDraft = async (newInputs: SendInputState, newNotes: Record<string, string>) => {
    if (!id) return;
    try {
      await AsyncStorage.setItem(`draft_po_send_${id}`, JSON.stringify({ sendInputs: newInputs, noteInputs: newNotes }));
    } catch (e) {
      console.error('Error saving draft', e);
    }
  };

  const handleUpdateInput = (productId: string, val: string) => {
    if (val !== '' && !/^[0-9.,]+$/.test(val)) return;
    setSendInputs(prev => {
      const next = { ...prev, [productId]: val };
      saveDraft(next, noteInputs);
      return next;
    });
  };

  const handleUpdateNote = (productId: string, val: string) => {
    setNoteInputs(prev => {
      const next = { ...prev, [productId]: val };
      saveDraft(sendInputs, next);
      return next;
    });
  };

  const handleIncrement = (productId: string) => {
    const current = parseStock(sendInputs[productId] || '0');
    setSendInputs(prev => {
      const next = { ...prev, [productId]: (current + 1).toString() };
      saveDraft(next, noteInputs);
      return next;
    });
  };

  const handleDecrement = (productId: string) => {
    const current = parseStock(sendInputs[productId] || '0');
    if (current > 0) {
      setSendInputs(prev => {
        const next = { ...prev, [productId]: (current - 1).toString() };
        saveDraft(next, noteInputs);
        return next;
      });
    }
  };

  const performSave = async () => {
    setSaving(true);
    try {
      const updatedItems: POItem[] = po!.items.map(item => ({
        ...item,
        sent_quantity: parseStock(sendInputs[item.product_id] || '0'),
        logistics_notes: noteInputs[item.product_id] || ''
      }));

      await updateDoc(doc(db, 'purchase_orders', po!.id), {
        status: 'SENT',
        items: updatedItems,
        processed_at: new Date().toISOString()
      });

      // Clear draft upon success
      await AsyncStorage.removeItem(`draft_po_send_${id}`);

      // Update local state to reflect changes immediately
      setPo({ ...po, status: 'SENT', items: updatedItems } as PurchaseOrder);

      AppAlert.show(
        'Berhasil', 
        'Barang berhasil dikirim (SENT). Menunggu validasi penerimaan dari Leader Shift tujuan.'
      );
      
    } catch (error: any) {
      console.error('Error saving PO:', error);
      AppAlert.show('Error', 'Gagal memproses pengiriman barang.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSent = async () => {
    if (!po) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'purchase_orders', po.id), {
        status: 'PENDING',
        processed_at: null
      });
      AppAlert.show('Dibatalkan', 'Pengiriman dibatalkan. PO kembali ke status PENDING, Anda bisa melanjutkan pengisian.');
      
      // Refresh local state without router replace
      setPo({ ...po, status: 'PENDING' } as PurchaseOrder);
    } catch (error) {
      console.error('Error cancelling PO:', error);
      AppAlert.show('Error', 'Gagal membatalkan pengiriman.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!po) return;
    
    // Validasi input kosong
    for (const item of po.items) {
      if (!sendInputs[item.product_id] || sendInputs[item.product_id] === '') {
        AppAlert.show('Perhatian', 'Semua jumlah kirim harus diisi. Masukkan 0 jika tidak mengirim barang tersebut.');
        return;
      }
    }
    
    const underSafeStockItems: string[] = [];
    po.items.forEach(item => {
      const prod = productsMap[item.product_id];
      const sisa = stockRecords[item.product_id] || 0;
      const sent = parseStock(sendInputs[item.product_id] || '0');
      if (prod && (sisa + sent) < prod.safety_stock) {
        underSafeStockItems.push(prod.name);
      }
    });

    if (underSafeStockItems.length > 0) {
      AppAlert.show(
        'Kondisi Stok Belum Aman',
        `Jumlah yang dikirim ditambah sisa stok belum memenuhi Stok Aman untuk barang berikut:\n- ${underSafeStockItems.join('\n- ')}\n\nTetap lanjutkan pengiriman?`,
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Tetap Kirim', style: 'default', onPress: performSave }
        ]
      );
      return;
    }

    performSave();
  };


  const handleAddCustomItem = (productId: string) => {
    if (!po) return;
    const newItem: POItem = {
      product_id: productId,
      requested_quantity: 0,
      sent_quantity: 0
    };
    
    setPo({
      ...po,
      items: [...po.items, newItem]
    });
    setSendInputs({
      ...sendInputs,
      [productId]: ''
    });
    setShowProductModal(false);
    setModalSearchQuery('');
  };

  const handleRemoveCustomItem = (productId: string) => {
    if (!po) return;
    setPo({
      ...po,
      items: po.items.filter(i => i.product_id !== productId)
    });
    const newInputs = { ...sendInputs };
    delete newInputs[productId];
    setSendInputs(newInputs);
  };

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
      // If 0 or empty, check if sisa is already safe
      if (sisa >= safe && safe > 0) return GREEN_SAFE; 
      return RED_TEXT;
    }
    if ((sisa + sent) >= safe) return GREEN_SAFE;
    return ORANGE_WARN;
  };

  if (loading || !po) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: BG_DARK }]}>
        <ActivityIndicator size="large" color={GOLD} />
      </View>
    );
  }

  const isReadOnly = po.status === 'SENT' || po.status === 'VALIDATED' || po.status === 'COMPLETE';

  // Helper function to render a representative icon based on product name
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
            <Text style={[Typography.screenTitle, { color: TEXT_PRIMARY, fontWeight: '300' }]}>Proses Pengiriman</Text>
            <Text style={[Typography.bodyMedium, { color: TEXT_SECONDARY }]}>
              PO-{po.id.split('-')[0].toUpperCase()} • Oleh: {po.created_by_name || 'Leader Barista'}
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

        {po.has_discrepancy && (
          <View style={{ backgroundColor: colors.outOfStockLight || 'rgba(255, 107, 107, 0.1)', padding: Spacing.m, borderRadius: 8, borderWidth: 1, borderColor: RED_TEXT, marginBottom: Spacing.m }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={RED_TEXT} />
              <Text style={[Typography.bodyLarge, { color: RED_TEXT, marginLeft: 8 }]}>Terdapat Perbedaan Data</Text>
            </View>
            <Text style={[Typography.bodyMedium, { color: TEXT_PRIMARY }]}>
              {po.validation_notes || 'Barista melakukan perubahan jumlah barang masuk. Kemungkinan terdapat kesalahan input atau pengiriman dari pihak Logistik.'}
            </Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.m, marginTop: Spacing.xs }}>
          <Text style={[Typography.cardTitle, { color: TEXT_PRIMARY }]}>
            Daftar Permintaan
          </Text>
          {!isReadOnly && (
            <TouchableOpacity onPress={() => setShowProductModal(true)} style={[styles.addCustomBtn, { borderColor: GOLD }]}>
              <MaterialCommunityIcons name="plus-circle-outline" size={20} color={GOLD} />
              <Text style={[styles.addCustomBtnText, { color: GOLD }]}>BARANG KHUSUS</Text>
            </TouchableOpacity>
          )}
        </View>

        {po.items.map(item => {
          const prod = productsMap[item.product_id];
          const dynamicColor = getStatusColor(item, prod);
          const isCustom = item.requested_quantity === 0;
          
          return (
            <View key={item.product_id} style={[styles.premiumCard, { backgroundColor: CARD_BG, borderColor: isReadOnly ? MUTED_BORDER : dynamicColor, shadowColor: isReadOnly ? 'transparent' : dynamicColor }]}>
              {isCustom && (
                <View style={[styles.customBadge, { backgroundColor: mode === 'dark' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(212, 175, 55, 0.15)' }]}>
                  <Text style={[styles.customBadgeText, { color: GOLD }]}>CUSTOM</Text>
                </View>
              )}
              <View style={styles.cardTopRow}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.m }}>
                    <Text style={[styles.productTitle, { color: TEXT_PRIMARY, marginBottom: 0 }]}>{prod?.name || 'Unknown'}</Text>
                    {isCustom && !isReadOnly && (
                      <TouchableOpacity 
                        onPress={() => handleRemoveCustomItem(item.product_id)}
                        style={{ padding: 4, backgroundColor: 'rgba(255,107,107,0.1)', borderRadius: 8, marginRight: 24 }}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={20} color={RED_TEXT} />
                      </TouchableOpacity>
                    )}
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

      {/* Sticky Bottom Buttons */}
      {!isReadOnly && (
        <View style={[styles.bottomBarPremium, { backgroundColor: BG_DARK }]}>
          <TouchableOpacity 
            style={[styles.hollowGoldBtn, { borderColor: GOLD, backgroundColor: mode === 'dark' ? 'rgba(212, 175, 55, 0.05)' : 'rgba(212, 175, 55, 0.1)' }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={[styles.hollowGoldBtnText, { color: GOLD }]}>{saving ? 'MEMPROSES...' : 'KIRIM BARANG (SENT)'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cancel Sent Button */}
      {po.status === 'SENT' && (
        <View style={[styles.bottomBarPremium, { backgroundColor: BG_DARK }]}>
          <TouchableOpacity 
            style={[styles.hollowGoldBtn, { borderColor: RED_TEXT, backgroundColor: 'rgba(255,107,107,0.1)' }]}
            onPress={handleCancelSent}
            disabled={saving}
          >
            <Text style={[styles.hollowGoldBtnText, { color: RED_TEXT }]}>{saving ? 'MEMPROSES...' : 'BATALKAN PENGIRIMAN'}</Text>
          </TouchableOpacity>
        </View>
      )}


      {/* Modal Pilih Barang Custom */}
      <Modal visible={showProductModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: CARD_BG, borderColor: BORDER_COLOR }]}>
            <View style={[styles.modalHeader, { borderBottomColor: BORDER_COLOR }]}>
              <Text style={[styles.modalTitle, { color: TEXT_PRIMARY }]}>Pilih Barang Tambahan</Text>
              <TouchableOpacity onPress={() => setShowProductModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={TEXT_PRIMARY} />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: Spacing.m, paddingTop: Spacing.m }}>
              <View style={[styles.searchBar, { backgroundColor: LIGHT_OPACITY, borderColor: BORDER_COLOR }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={MUTED} />
                <TextInput
                  style={[styles.searchInput, { color: TEXT_PRIMARY }]}
                  placeholder="Cari nama barang..."
                  placeholderTextColor={MUTED}
                  value={modalSearchQuery}
                  onChangeText={setModalSearchQuery}
                />
                {modalSearchQuery !== '' && (
                  <TouchableOpacity onPress={() => setModalSearchQuery('')}>
                    <MaterialCommunityIcons name="close-circle" size={16} color={MUTED} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            
            <FlatList
              data={Object.values(productsMap)
                .filter(p => !po?.items.some(i => i.product_id === p.id))
                .filter(p => p.name.toLowerCase().includes(modalSearchQuery.toLowerCase()))
              }
              keyExtractor={p => p.id}
              contentContainerStyle={{ padding: Spacing.m }}
              renderItem={({ item: p }) => (
                <TouchableOpacity 
                  style={[styles.modalItem, { borderBottomColor: BORDER_COLOR }]}
                  onPress={() => handleAddCustomItem(p.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalItemName, { color: TEXT_PRIMARY }]}>{p.name}</Text>
                    <Text style={[styles.modalItemMeta, { color: TEXT_SECONDARY }]}>
                      Sisa: {stockRecords[p.id] !== undefined ? stockRecords[p.id] : '?'} | Aman: {p.safety_stock} {p.unit}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="plus" size={24} color={GOLD} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={{ color: TEXT_SECONDARY, textAlign: 'center', marginTop: 20 }}>
                  Semua barang sudah ada dalam PO ini.
                </Text>
              }
            />
          </View>
        </View>
      </Modal>

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
  
  bottomBarPremium: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.xl, paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xl },
  hollowGoldBtn: {
    borderWidth: 1,
    borderColor: '#D4AF37',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  hollowGoldBtnText: { color: '#D4AF37', fontSize: 16, fontWeight: '600', letterSpacing: 1 },
  
  addCustomBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: Spacing.m, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.4)', borderRadius: 12, borderStyle: 'dashed' },
  addCustomBtnText: { color: '#D4AF37', marginLeft: 8, fontWeight: 'bold' },
  customBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: 'rgba(212, 175, 55, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderBottomLeftRadius: 12, borderTopRightRadius: 20 },
  customBadgeText: { color: '#D4AF37', fontSize: 8, fontWeight: 'bold', letterSpacing: 1 },
  
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
  },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#181C25', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '70%', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.l, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.m, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  modalItemName: { color: '#FFF', fontSize: 16, fontWeight: '500' },
  modalItemMeta: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 12, height: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  searchInput: { flex: 1, color: '#FFF', marginLeft: 8, fontSize: 14 }
});
