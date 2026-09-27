import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { AppCard } from '../../../src/components/AppCard';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { FadeInView } from '../../../src/components/FadeInView';
import { Typography } from '../../../src/constants/Typography';
import { Spacing } from '../../../src/constants/Colors';
import { useTheme } from '../../../src/context/ThemeContext';
import { db } from '../../../src/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { PurchaseOrder } from '../../../src/types/stock';

export default function LogisticsRegularPOListScreen() {
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
        where('type', '==', 'REGULAR')
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
      console.error('Error fetching POs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPOs();
  };

  const renderItem = ({ item, index }: { item: PurchaseOrder, index: number }) => (
    <FadeInView delay={index * 50}>
      <TouchableOpacity activeOpacity={0.8} onPress={() => router.push(`/(logistics)/regular-po/${item.id}`)}>
        <AppCard style={[styles.card, { borderColor: 'rgba(0,122,255,0.15)', borderWidth: 1, padding: Spacing.m }]}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
                <MaterialCommunityIcons name="package-variant-closed" size={24} color={colors.primary} />
              </View>
              <View style={{ marginLeft: Spacing.m, flex: 1 }}>
                <Text style={[Typography.cardTitle, { color: colors.textPrimary }]}>
                  PO-{item.id.split('-')[0].toUpperCase()}
                </Text>
                <View style={[styles.infoRow, { marginTop: 4, marginBottom: 0 }]}>
                  <MaterialCommunityIcons name="calendar-month-outline" size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={[Typography.bodySmall, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.operational_date}  •  Shift {item.source_shift_number}
                  </Text>
                </View>
              </View>
            </View>
            <StatusBadge status={item.status} />
          </View>
        </AppCard>
      </TouchableOpacity>
    </FadeInView>
  );

  return (
    <ScreenContainer padding={false}>
      <View style={[styles.header, { padding: Spacing.l, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.replace('/(logistics)')} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[Typography.screenTitle, { color: colors.textPrimary }]}>Regular PO</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : (
        <FlatList
          data={pos}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
          ListEmptyComponent={
            <FadeInView delay={100}>
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="file-document-outline" size={48} color={colors.border} style={{ marginBottom: Spacing.m }} />
                <Text style={[Typography.cardTitle, { color: colors.textSecondary }]}>Belum ada Regular PO</Text>
              </View>
            </FadeInView>
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
    paddingTop: Spacing.xl,
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
    padding: Spacing.m,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.s,
  },
  cardBody: {
    marginTop: Spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
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
  }
});
