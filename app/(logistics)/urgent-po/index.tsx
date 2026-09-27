import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { AppCard } from '../../../src/components/AppCard';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { Typography } from '../../../src/constants/Typography';
import { Spacing } from '../../../src/constants/Colors';
import { useTheme } from '../../../src/context/ThemeContext';
import { db } from '../../../src/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { PurchaseOrder } from '../../../src/types/stock';

export default function LogisticsUrgentPOListScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      fetchPOs();
    }, [])
  );

  const fetchPOs = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'purchase_orders'),
        where('type', '==', 'URGENT')
      );
      const snap = await getDocs(q);
      const fetched: PurchaseOrder[] = [];
      snap.forEach(doc => {
        const data = doc.data() as PurchaseOrder;
        
        // Hide COMPLETE or VALIDATED POs older than 24 hours from completion
        if (data.status === 'COMPLETE' || data.status === 'VALIDATED') {
          const completedAt = new Date(data.updated_at || data.created_at || new Date().toISOString()).getTime();
          const now = Date.now();
          const hours24 = 24 * 60 * 60 * 1000;
          if (now - completedAt > hours24) {
            return;
          }
        }
        
        fetched.push({ id: doc.id, ...data });
      });
      // Sort by status -> operational_date desc -> shift desc
      fetched.sort((a, b) => {
        const statusPriority: Record<string, number> = {
          'PENDING': 0,
          'SENT': 1,
          'VALIDATED': 2,
          'COMPLETE': 3
        };
        const pA = statusPriority[a.status] ?? 99;
        const pB = statusPriority[b.status] ?? 99;
        
        if (pA !== pB) return pA - pB;

        const dateA = new Date(a.operational_date).getTime();
        const dateB = new Date(b.operational_date).getTime();
        if (dateA !== dateB) return dateB - dateA;

        return (b.source_shift_number || 0) - (a.source_shift_number || 0);
      });
      setPos(fetched);
    } catch (error) {
      console.error('Error fetching Urgent POs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPOs();
  };

  const renderItem = ({ item }: { item: PurchaseOrder }) => (
    <TouchableOpacity onPress={() => router.push(`/(logistics)/urgent-po/${item.id}`)}>
        <AppCard style={[styles.card, { borderColor: 'rgba(255,59,48,0.2)', borderWidth: 1, padding: Spacing.m }]}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={[styles.iconBox, { backgroundColor: colors.outOfStockLight }]}>
                <MaterialCommunityIcons name="alert-decagram-outline" size={24} color={colors.outOfStock} />
              </View>
              <View style={{ marginLeft: Spacing.m, flex: 1 }}>
                <Text style={[Typography.cardTitle, { color: colors.textPrimary }]}>
                  UPO-{item.id.split('-')[0].toUpperCase()}
                </Text>
                <View style={[styles.infoRow, { marginTop: 4, marginBottom: 0 }]}>
                  <Text style={[Typography.bodySmall, { color: colors.textSecondary }]} numberOfLines={1}>
                    Shift {item.source_shift_number} ({item.operational_date})
                  </Text>
                </View>
                <Text style={[Typography.bodySmall, { color: colors.textSecondary, marginTop: 4 }]}>
                  Oleh: {item.created_by_name || 'Leader Barista'}
                </Text>
              </View>
            </View>
            <StatusBadge status={item.status} />
          </View>
        </AppCard>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer padding={false}>
      <View style={[styles.header, { padding: Spacing.l }]}>
        <TouchableOpacity onPress={() => router.replace('/(logistics)')} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[Typography.screenTitle, { color: colors.textPrimary }]}>Urgent PO (Receiving)</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : (
        <FlatList
          data={pos}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="alert-decagram-outline" size={48} color={colors.border} style={{ marginBottom: Spacing.m }} />
              <Text style={[Typography.cardTitle, { color: colors.textSecondary }]}>Belum ada Urgent PO</Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: Spacing.m,
  },
  listContent: {
    padding: Spacing.l,
    paddingBottom: Spacing.xxl * 2,
  },
  card: {
    marginBottom: Spacing.m,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  }
});
