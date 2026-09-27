import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { AppCard } from '../../../src/components/AppCard';
import { AppButton } from '../../../src/components/AppButton';
import { AppTextInput } from '../../../src/components/AppTextInput';
import { Typography } from '../../../src/constants/Typography';
import { Spacing } from '../../../src/constants/Colors';
import { useTheme } from '../../../src/context/ThemeContext';
import { useAuth } from '../../../src/context/AuthContext';
import { db } from '../../../src/lib/firebase';
import { collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { ProductWithCategory } from '../../../src/types/master';
import { getOperationalDate } from '../../../src/utils/date';
import { AppAlert } from '../../../src/components/AppAlert';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

type QuantityState = Record<string, number>;

export default function UrgentPOScreen() {
  const { colors } = useTheme();
  const { activeShift, activeLeader } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [quantities, setQuantities] = useState<QuantityState>({});
  const [stockRecords, setStockRecords] = useState<Record<string, number>>({});
  
  const operationalDate = useMemo(() => getOperationalDate(), []);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'products'), where('active', '==', true));
      const snap = await getDocs(q);
      const productsData: ProductWithCategory[] = [];
      snap.forEach(doc => {
        productsData.push({ id: doc.id, ...doc.data() } as ProductWithCategory);
      });
      
      setProducts(productsData);
      
      const initial: QuantityState = {};
      productsData.forEach(p => {
        initial[p.id] = 0;
      });
      setQuantities(initial);
      setQuantities(initial);
      
      // Fetch latest stock taking to get current stock
      const opDate = getOperationalDate();
      let currentShift = activeShift || 1;
      let stockSnap = await getDocs(query(
        collection(db, 'stock_takings'),
        where('operational_date', '==', opDate),
        where('shift_number', '==', currentShift)
      ));

      // If current shift hasn't done stock taking, check previous shift
      if (stockSnap.empty) {
        let prevShift = currentShift - 1;
        let prevDate = opDate;
        if (prevShift === 0) {
          prevShift = 4;
          const d = new Date(opDate);
          d.setDate(d.getDate() - 1);
          prevDate = d.toISOString().split('T')[0];
        }
        stockSnap = await getDocs(query(
          collection(db, 'stock_takings'),
          where('operational_date', '==', prevDate),
          where('shift_number', '==', prevShift)
        ));
      }

      const stockMap: Record<string, number> = {};
      if (!stockSnap.empty) {
        const data = stockSnap.docs[0].data();
        data.items?.forEach((item: any) => {
          stockMap[item.product_id] = item.actual_stock;
        });
      }
      setStockRecords(stockMap);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      AppAlert.show('Error', 'Gagal memuat daftar produk dan stok');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (productId: string) => {
    setQuantities(prev => ({ ...prev, [productId]: prev[productId] ? 0 : 1 }));
  };

  const handleSave = async () => {
    if (products.length === 0) return;
    
    const items = products
      .filter(p => (quantities[p.id] || 0) > 0)
      .map(p => ({
        product_id: p.id,
        requested_quantity: quantities[p.id] || 0
      }));

    if (items.length === 0) {
      AppAlert.show('Perhatian', 'Anda belum memasukkan jumlah barang untuk di-PO.');
      return;
    }
    
    setSaving(true);
    try {
      const poId = generateUUID();
      await setDoc(doc(db, 'purchase_orders', poId), {
        id: poId,
        type: 'URGENT',
        status: 'PENDING',
        operational_date: operationalDate,
        source_shift_number: activeShift || 1,
        target_shift_number: 0,
        target_operational_date: '', // Logistics will fill these
        created_at: new Date().toISOString(),
        created_by_name: activeLeader?.full_name || 'Leader Barista',
        items: items
      });

      AppAlert.show(
        'Berhasil', 
        `Urgent PO berhasil dikirim.\n\nItem: ${items.length}\nMenunggu konfirmasi Logistik.`, 
        [{ text: 'OK', onPress: () => router.replace('/(barista)') }]
      );
      
    } catch (error: any) {
      console.error('Error saving PO:', error);
      AppAlert.show('Error', error.message || 'Gagal mengirim PO. Silakan coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  
  const groupedProducts = useMemo(() => {
    const groups: Record<string, ProductWithCategory[]> = {};
    filteredProducts.forEach(p => {
      const catName = p.categories?.name || 'Uncategorized';
      if (!groups[catName]) groups[catName] = [];
      groups[catName].push(p);
    });
    return groups;
  }, [filteredProducts]);

  const totalItems = useMemo(() => {
    return Object.values(quantities).filter(v => v > 0).length;
  }, [quantities]);

  const SHIFTS = [1, 2, 3, 4];

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: colors.background }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} disabled={saving}>
            <Feather name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={[Typography.screenTitle, { color: colors.textPrimary }]}>Urgent PO</Text>
            <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>
              {operationalDate}
            </Text>
          </View>
        </View>



        <View style={styles.searchContainer}>
          <AppTextInput
            placeholder="Cari produk..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            editable={!saving}
          />
        </View>

        {/* Product List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : products.length === 0 ? (
          <View style={styles.centerContainer}>
            <Feather name="box" size={48} color={colors.border} style={{ marginBottom: Spacing.m }} />
            <Text style={[Typography.cardTitle, { color: colors.textSecondary }]}>Tidak ada produk aktif</Text>
          </View>
        ) : (
          Object.entries(groupedProducts).map(([category, items]) => (
            <View key={category} style={styles.categorySection}>
              <View style={[styles.categoryHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <Text style={[Typography.labelSmall, { color: colors.textSecondary }]}>{category.toUpperCase()}</Text>
              </View>
              
              {items.map(product => {
                const qty = quantities[product.id] || 0;
                
                return (
                  <AppCard key={product.id} style={styles.productCard}>
                    <View style={styles.productInfo}>
                      <Text style={[Typography.cardTitle, { color: colors.textPrimary }]}>{product.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: Spacing.m }}>
                        <Text style={[Typography.bodySecondary, { color: colors.textSecondary }]}>
                          Satuan: {product.unit}
                        </Text>
                        <View style={{ width: 1, height: 12, backgroundColor: colors.border }} />
                        <Text style={[Typography.bodySecondary, { color: colors.textSecondary, fontWeight: 'bold' }]}>
                          Sisa: {stockRecords[product.id] !== undefined ? stockRecords[product.id] : '?'} {product.unit}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.actionContainer}>
                      <TouchableOpacity 
                        style={[
                          styles.poButton, 
                          { 
                            backgroundColor: qty > 0 ? colors.outOfStock : colors.surface, 
                            borderColor: colors.outOfStock 
                          }
                        ]}
                        onPress={() => toggleSelection(product.id)}
                        disabled={saving}
                      >
                        <Text style={[Typography.labelSmall, { color: qty > 0 ? colors.surface : colors.outOfStock }]}>
                          {qty > 0 ? 'DIPILIH' : '+ PO'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </AppCard>
                );
              })}
            </View>
          ))
        )}
        
      </ScrollView>

      {/* Sticky Bottom Save Button */}
      {!loading && products.length > 0 && (
        <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <AppButton
            title={saving ? 'Memproses...' : `Kirim Urgent PO (${totalItems} item)`}
            onPress={handleSave}
            disabled={saving || totalItems === 0}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: Spacing.l,
    paddingBottom: Spacing.xxl * 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.l,
  },
  backButton: {
    marginRight: Spacing.m,
    padding: Spacing.xs,
  },
  shiftSelector: {
    flexDirection: 'row',
    gap: Spacing.s,
    marginBottom: Spacing.xs,
  },
  shiftChip: {
    flex: 1,
    paddingVertical: Spacing.m,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    marginBottom: Spacing.m,
  },
  centerContainer: {
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
  },
  categorySection: {
    marginBottom: Spacing.l,
  },
  categoryHeader: {
    paddingVertical: Spacing.s,
    paddingHorizontal: Spacing.s,
    marginBottom: Spacing.s,
    borderRadius: 8,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.s,
    padding: Spacing.m,
  },
  productInfo: {
    flex: 1,
    marginRight: Spacing.m,
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  poButton: {
    paddingHorizontal: Spacing.m,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.l,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  }
});
