import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { AppCard } from '../../../src/components/AppCard';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { Typography } from '../../../src/constants/Typography';
import { Spacing } from '../../../src/constants/Colors';
import { useTheme } from '../../../src/context/ThemeContext';
import { db } from '../../../src/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { PurchaseOrder, POStatus } from '../../../src/types/stock';
import { AppAlert } from '../../../src/components/AppAlert';
import { AppTextInput } from '../../../src/components/AppTextInput';

interface POItemDetail {
  id: string;
  product_name: string;
  unit: string;
  requested_quantity: number;
  provided_quantity: number;
}

export default function RegularPODetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<POItemDetail[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchPODetail();
  }, [id]);

  const fetchPODetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const poSnap = await getDoc(doc(db, 'purchase_orders', id));
      if (!poSnap.exists()) throw new Error('PO not found');
      const poData = { id: poSnap.id, ...poSnap.data() } as unknown as PurchaseOrder;
      setPo(poData);

      let rawItems: any[] = [];
      const itemsQ = query(collection(db, 'purchase_order_items'), where('purchase_order_id', '==', id));
      const itemsSnap = await getDocs(itemsQ);
      itemsSnap.forEach(d => rawItems.push({ id: d.id, ...d.data() }));

      if (rawItems.length === 0 && poData.items && poData.items.length > 0) {
        rawItems = poData.items;
      }
      
      const prodSnap = await getDocs(collection(db, 'products'));
      const prodMap: Record<string, any> = {};
      prodSnap.forEach(d => prodMap[d.id] = d.data());

      const formattedItems: POItemDetail[] = [];
      rawItems.forEach(item => {
        const product = prodMap[item.product_id] || {};
        formattedItems.push({
          id: item.id || item.product_id,
          product_name: product.name || 'Unknown',
          unit: product.unit || '-',
          requested_quantity: item.requested_quantity || 0,
          provided_quantity: item.fulfilled_quantity || item.validated_quantity || item.sent_quantity || 0
        });
      });

      setItems(formattedItems);
    } catch (error) {
      console.error('Error fetching PO detail:', error);
      AppAlert.show('Error', 'Gagal memuat detail PO');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const getReceivingShift = (sourceShift: number) => {
    if (sourceShift === 2) return 3;
    if (sourceShift === 4) return 2;
    return '-';
  };

  const getItemStatus = (requested: number, provided: number): POStatus => {
    if (provided === 0) return 'PENDING';
    if (provided >= requested) return 'COMPLETE';
    return 'PARTIAL';
  };

  if (loading || !po) {
    return (
      <ScreenContainer>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer padding={false}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={[Typography.screenTitle, { color: colors.textPrimary }]}>PO Detail</Text>
            <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>
              PO-{po.id.split('-')[0].toUpperCase()}
            </Text>
          </View>
        </View>

        <AppCard style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={[Typography.labelSmall, { color: colors.textSecondary }]}>TANGGAL</Text>
              <Text style={[Typography.bodyLarge, { color: colors.textPrimary, marginTop: 4 }]}>{po.operational_date}</Text>
            </View>
            <StatusBadge status={po.status} />
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.shiftRow}>
            <View style={styles.shiftBox}>
              <Text style={[Typography.labelSmall, { color: colors.textSecondary }]}>SOURCE SHIFT</Text>
              <Text style={[Typography.cardTitle, { color: colors.textPrimary, marginTop: 4 }]}>Shift {po.source_shift_number}</Text>
            </View>
            <Feather name="arrow-right" size={20} color={colors.border} />
            <View style={styles.shiftBox}>
              <Text style={[Typography.labelSmall, { color: colors.textSecondary }]}>RECEIVING SHIFT</Text>
              <Text style={[Typography.cardTitle, { color: colors.textPrimary, marginTop: 4 }]}>Shift {getReceivingShift(po.source_shift_number)}</Text>
            </View>
          </View>
        </AppCard>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.m, marginTop: Spacing.l }}>
          <Text style={[Typography.cardTitle, { color: colors.textPrimary }]}>
            Items ({items.length})
          </Text>
        </View>

        <View style={{ marginBottom: Spacing.m }}>
          <AppTextInput
            placeholder="Cari produk..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {items.filter(item => item.product_name.toLowerCase().includes(searchQuery.toLowerCase())).map(item => {
          const remaining = item.requested_quantity - item.provided_quantity;
          const status = getItemStatus(item.requested_quantity, item.provided_quantity);
          
          return (
            <AppCard key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={[Typography.cardTitle, { color: colors.textPrimary }]}>{item.product_name}</Text>
                <StatusBadge status={status} />
              </View>
              
              <View style={styles.itemStats}>
                <View style={styles.statBox}>
                  <Text style={[Typography.labelSmall, { color: colors.textSecondary }]}>REQUESTED</Text>
                  <Text style={[Typography.bodyLarge, { color: colors.textPrimary, marginTop: 4 }]}>{item.requested_quantity} {item.unit}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[Typography.labelSmall, { color: colors.textSecondary }]}>PROVIDED</Text>
                  <Text style={[Typography.bodyLarge, { color: colors.textPrimary, marginTop: 4 }]}>{item.provided_quantity} {item.unit}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[Typography.labelSmall, { color: colors.textSecondary }]}>REMAINING</Text>
                  <Text style={[Typography.bodyLarge, { color: colors.textPrimary, marginTop: 4 }]}>{remaining} {item.unit}</Text>
                </View>
              </View>
            </AppCard>
          );
        })}
        
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: Spacing.l,
    paddingBottom: Spacing.xxl,
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
  summaryCard: {
    padding: Spacing.l,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: Spacing.m,
  },
  shiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shiftBox: {
    flex: 1,
  },
  itemCard: {
    marginBottom: Spacing.m,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.m,
  },
  itemStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
  }
});
