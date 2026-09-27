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
import { collection, query, where, getDocs, orderBy, doc, setDoc, writeBatch } from 'firebase/firestore';
import { ProductWithCategory } from '../../../src/types/master';
import { getOperationalDate } from '../../../src/utils/date';
import { AppAlert } from '../../../src/components/AppAlert';

type QuantityState = Record<string, number>;

export default function RegularPOScreen() {
  const { colors } = useTheme();
  const { activeLeader, activeShift } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Regular PO allowed only on Shift 2 or Shift 4
  const [shiftNumber, setShiftNumber] = useState<number>(2);
  const [quantities, setQuantities] = useState<QuantityState>({});
  
  const operationalDate = useMemo(() => getOperationalDate(), []);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const [prodSnap, catSnap] = await Promise.all([
        getDocs(collection(db, 'products')),
        getDocs(query(collection(db, 'categories'), where('active', '==', true)))
      ]);

      const catMap: Record<string, any> = {};
      catSnap.forEach(d => catMap[d.id] = { id: d.id, ...d.data() });

      const productsData: ProductWithCategory[] = [];
      prodSnap.forEach(d => {
        const pData = d.data();
        if (pData.active) {
          productsData.push({
            id: d.id,
            ...pData,
            categories: catMap[pData.category_id]
          } as unknown as ProductWithCategory);
        }
      });
      productsData.sort((a, b) => a.name.localeCompare(b.name));
      setProducts(productsData);
      
      const initial: QuantityState = {};
      productsData.forEach(p => {
        initial[p.id] = 0;
      });
      setQuantities(initial);
      
    } catch (error) {
      console.error('Error fetching products:', error);
      AppAlert.show('Error', 'Gagal memuat daftar produk');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (productId: string) => {
    setQuantities(prev => ({ ...prev, [productId]: prev[productId] ? 0 : 1 }));
  };

  const handleSave = async () => {
    if (products.length === 0) return;
    
    // Only submit items with requested_quantity > 0
    const items: any[] = products
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
      const batch = writeBatch(db);
      
      const poId = `po-${Date.now()}`;
      const poRef = doc(db, 'purchase_orders', poId);
      
      batch.set(poRef, {
        id: poId,
        operational_date: operationalDate,
        source_shift_number: shiftNumber,
        requested_by: activeLeader?.id || 'unknown',
        requested_by_name: activeLeader?.full_name || 'Leader Shift ' + shiftNumber,
        status: 'PENDING',
        type: 'REGULAR',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      items.forEach(item => {
        const itemId = `poi-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const itemRef = doc(db, 'purchase_order_items', itemId);
        batch.set(itemRef, {
          id: itemId,
          purchase_order_id: poId,
          product_id: item.product_id,
          requested_quantity: item.requested_quantity,
          fulfilled_quantity: 0
        });
      });
      
      await batch.commit();

      AppAlert.show(
        'Berhasil', 
        `Regular PO berhasil dikirim.\n\nShift: ${shiftNumber}\nItem: ${items.length}`, 
        [{ text: 'OK', onPress: () => router.replace('/(barista)/regular-po') }]
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
            <Text style={[Typography.screenTitle, { color: colors.textPrimary }]}>Regular PO</Text>
            <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>
              {operationalDate}
            </Text>
          </View>
        </View>

        {/* Shift Selector */}
        <Text style={[Typography.cardTitle, { color: colors.textPrimary, marginBottom: Spacing.s }]}>
          Pilih Shift Source
        </Text>
        <View style={styles.shiftSelector}>
          {[2, 4].map(shift => (
            <TouchableOpacity
              key={shift}
              style={[
                styles.shiftChip,
                { 
                  backgroundColor: shiftNumber === shift ? colors.primary : colors.surface,
                  borderColor: shiftNumber === shift ? colors.primary : colors.border
                }
              ]}
              onPress={() => !saving && setShiftNumber(shift)}
            >
              <Text style={[
                Typography.bodyMedium,
                { color: shiftNumber === shift ? colors.surface : colors.textPrimary }
              ]}>
                Shift {shift}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[Typography.bodySecondary, { color: colors.textSecondary, marginBottom: Spacing.s }]}>
          * Regular PO hanya dapat dibuat pada Shift 2 dan 4.
        </Text>
        <Text style={[Typography.bodySecondary, { color: colors.primary, marginBottom: Spacing.l }]}>
          {shiftNumber === 2 
            ? 'PO ini akan diterima pada Shift 3.' 
            : 'PO ini akan diterima pada Shift 2 hari berikutnya.'}
        </Text>

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
                      <Text style={[Typography.bodySecondary, { color: colors.textSecondary, marginTop: 2 }]}>
                        Satuan: {product.unit}
                      </Text>
                      <Text style={[Typography.bodySecondary, { color: colors.textSecondary }]}>
                        Safety: {product.safety_stock}
                      </Text>
                    </View>
                    
                    <View style={styles.actionContainer}>
                      <TouchableOpacity 
                        style={[
                          styles.poButton, 
                          { 
                            backgroundColor: qty > 0 ? colors.primary : colors.surface, 
                            borderColor: colors.primary 
                          }
                        ]}
                        onPress={() => toggleSelection(product.id)}
                        disabled={saving}
                      >
                        <Text style={[Typography.labelSmall, { color: qty > 0 ? colors.surface : colors.primary }]}>
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
            title={saving ? 'Memproses...' : `Kirim Request PO (${totalItems} item)`}
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
