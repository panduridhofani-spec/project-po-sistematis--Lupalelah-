import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList } from 'react-native';
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
import { getOperationalDate } from '../../src/utils/date';
import { useAuth } from '../../src/context/AuthContext';

type StockFilter = 'All' | 'Safe' | 'Need PO' | 'Out';
type Category = 'All' | 'Minuman' | 'Snacks' | 'Makanan Besar' | 'Pastry' | 'Lainnya';

interface ProductData {
  id: string;
  name: string;
  qty: number;
  status: 'SAFE' | 'NEED_PO' | 'OUT_OF_STOCK';
  safeQty: number;
  category: string;
  unit: string;
}

export default function StockScreen() {
  const { colors } = useTheme();
  const { activeShift } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StockFilter>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dynamicCategories, setDynamicCategories] = useState<string[]>(['All']);

  const statuses: StockFilter[] = ['All', 'Safe', 'Need PO', 'Out'];

  useEffect(() => {
    fetchProducts();
  }, [activeShift]);

  const fetchProducts = async () => {
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
      setDynamicCategories(['All', ...catNames]);

      // 2. Fetch products
      const prodSnap = await getDocs(query(collection(db, 'products'), where('active', '==', true)));
      const fetchedProducts: any[] = [];
      prodSnap.forEach(doc => {
        fetchedProducts.push({ id: doc.id, ...doc.data() });
      });

      // 3. Fetch latest stock taking to get current stock
      const opDate = getOperationalDate();
      let currentShift = activeShift || 1;
      
      // Try current shift
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
      console.error('Error fetching stock:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'All' || p.category === categoryFilter;
    const matchStatus = statusFilter === 'All' || 
                        (statusFilter === 'Safe' && p.status === 'SAFE') ||
                        (statusFilter === 'Need PO' && p.status === 'NEED_PO') ||
                        (statusFilter === 'Out' && p.status === 'OUT_OF_STOCK');
    
    return matchSearch && matchCat && matchStatus;
  });

  return (
    <ScreenContainer padding={false}>
      <View style={styles.header}>
        <Text style={[Typography.screenTitle, { color: colors.textPrimary, marginBottom: Spacing.m }]}>Stock</Text>
        <SearchBar 
          placeholder="Search products..." 
          value={search}
          onChangeText={setSearch}
        />
        
        <View style={styles.filtersContainer}>
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
      </View>

      <FlatList
        data={filteredProducts}
        keyExtractor={item => item.id}
        refreshing={loading}
        onRefresh={fetchProducts}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <AppCard style={styles.productCard}>
            <View style={styles.productInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={[Typography.cardTitle, { color: colors.textPrimary, fontSize: 15 }]}>
                  {item.name} <Text style={[Typography.bodySmall, { color: colors.textSecondary, fontWeight: 'normal' }]}>({item.category})</Text>
                </Text>
              </View>
              
              <View style={[styles.stockDetails, { flexDirection: 'row', alignItems: 'center' }]}>
                <Text style={[Typography.stockNumber, { color: colors.textPrimary, fontSize: 18, marginRight: Spacing.s }]}>
                  {item.qty} <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>{item.unit}</Text>
                </Text>
                <StatusBadge status={item.status} />
                <View style={{ flex: 1 }} />
                <Text style={[Typography.labelSmall, { color: colors.textSecondary, fontSize: 10 }]}>
                  Safety: {item.safeQty}
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={16} color={colors.textSecondary} style={{ marginLeft: Spacing.s }} />
          </AppCard>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: Spacing.l,
    paddingBottom: 0,
  },
  filtersContainer: {
    marginBottom: Spacing.m,
  },
  chipRow: {
    marginBottom: Spacing.m,
  },
  listContent: {
    padding: Spacing.m,
    paddingBottom: Spacing.xxl,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.m,
    paddingVertical: 12,
    marginBottom: Spacing.s,
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
