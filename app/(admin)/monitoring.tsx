import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, ActivityIndicator } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { SearchBar } from '../../src/components/SearchBar';
import { FilterChip } from '../../src/components/FilterChip';
import { AppCard } from '../../src/components/AppCard';
import { StatusBadge } from '../../src/components/StatusBadge';
import { Typography } from '../../src/constants/Typography';
import { Spacing } from '../../src/constants/Colors';
import { Feather } from '@expo/vector-icons';
import { db } from '../../src/lib/firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

type StockFilter = 'Semua' | 'Perlu PO' | 'Habis';

interface ProductData {
  id: string;
  name: string;
  qty: number;
  status: 'SAFE' | 'NEED_PO' | 'OUT_OF_STOCK';
  safeQty: number;
  category: string;
  unit: string;
}

export default function AdminMonitoring() {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StockFilter>('Semua');
  const [categoryFilter, setCategoryFilter] = useState<string>('Semua');
  const statuses: StockFilter[] = ['Semua', 'Perlu PO', 'Habis'];
  
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dynamicCategories, setDynamicCategories] = useState<string[]>(['Semua']);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch categories
      const catSnap = await getDocs(collection(db, 'categories'));
      const catMap: Record<string, string> = {};
      const catNames: string[] = [];
      catSnap.forEach(doc => {
        const name = doc.data().name;
        catMap[doc.id] = name;
        if (doc.data().active) catNames.push(name);
      });
      catNames.sort();
      setDynamicCategories(['Semua', ...catNames]);

      // 2. Fetch products
      const prodSnap = await getDocs(query(collection(db, 'products'), where('active', '==', true)));
      const fetchedProducts: any[] = [];
      prodSnap.forEach(doc => {
        fetchedProducts.push({ id: doc.id, ...doc.data() });
      });

      // 3. Fetch LATEST stock taking overall to get current stock
      let stockSnap = await getDocs(query(
        collection(db, 'stock_takings'),
        orderBy('created_at', 'desc'),
        limit(1)
      ));

      const stockMap: Record<string, { qty: number, status: string }> = {};
      if (!stockSnap.empty) {
        const data = stockSnap.docs[0].data();
        data.items?.forEach((item: any) => {
          stockMap[item.product_id] = {
            qty: item.actual_stock,
            status: item.stock_status
          };
        });
      }

      const finalProducts: ProductData[] = fetchedProducts.map(p => {
        const stockInfo = stockMap[p.id] || { qty: 0, status: 0 < p.safety_stock ? 'OUT_OF_STOCK' : 'SAFE' };
        
        let status: 'SAFE' | 'NEED_PO' | 'OUT_OF_STOCK' = 'SAFE';
        if (stockInfo.qty === 0) status = 'OUT_OF_STOCK';
        else if (stockInfo.qty < p.safety_stock) status = 'NEED_PO';

        return {
          id: p.id,
          name: p.name,
          qty: stockInfo.qty,
          status: status,
          safeQty: p.safety_stock,
          category: catMap[p.category_id] || 'Lainnya',
          unit: p.unit || 'pcs'
        };
      });

      setProducts(finalProducts);
    } catch (error) {
      console.error('Error fetching admin monitoring:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'Semua' || p.category === categoryFilter;
    const matchStatus = statusFilter === 'Semua' || 
                        (statusFilter === 'Perlu PO' && p.status === 'NEED_PO') ||
                        (statusFilter === 'Habis' && p.status === 'OUT_OF_STOCK');
    
    return matchSearch && matchCat && matchStatus;
  });

  return (
    <ScreenContainer padding={false}>
      <View style={styles.header}>
        <Text style={[Typography.screenTitle, { color: colors.textPrimary, marginBottom: Spacing.m }]}>Monitoring Stok</Text>
        <SearchBar 
          placeholder="Cari produk..." 
          value={search}
          onChangeText={setSearch}
        />
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {statuses.map(status => (
            <FilterChip 
              key={status}
              label={status}
              active={statusFilter === status}
              onPress={() => setStatusFilter(status)}
            />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {dynamicCategories.map(cat => (
            <FilterChip 
              key={cat}
              label={cat}
              active={categoryFilter === cat}
              onPress={() => setCategoryFilter(cat)}
            />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={item => item.id}
          refreshing={loading}
          onRefresh={fetchData}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <AppCard style={styles.productCard}>
              <View style={styles.productInfo}>
                <Text style={[Typography.cardTitle, { color: colors.textPrimary, marginBottom: 4 }]}>{item.name}</Text>
                <Text style={[Typography.bodySecondary, { color: colors.textSecondary, marginBottom: Spacing.m }]}>{item.category}</Text>
                
                <View style={styles.stockDetails}>
                  <View style={styles.qtyContainer}>
                    <Text style={[Typography.stockNumber, { color: colors.textPrimary, marginRight: Spacing.m }]}>
                      {item.qty} <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>{item.unit}</Text>
                    </Text>
                    <StatusBadge status={item.status} />
                  </View>
                  <Text style={[Typography.labelSmall, { color: colors.textSecondary, marginTop: Spacing.xs }]}>
                    Stok aman: {item.safeQty} {item.unit}
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color={colors.textSecondary} />
            </AppCard>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: Spacing.l,
    paddingBottom: 0,
  },
  chipRow: {
    marginBottom: Spacing.m,
  },
  listContent: {
    padding: Spacing.l,
    paddingBottom: Spacing.xxl,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.l,
    marginBottom: Spacing.m,
  },
  productInfo: {
    flex: 1,
  },
  stockDetails: {
    marginTop: Spacing.xs,
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

