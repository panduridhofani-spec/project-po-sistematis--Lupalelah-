import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { AppCard } from '../../src/components/AppCard';
import { StatusBadge } from '../../src/components/StatusBadge';
import { FadeInView } from '../../src/components/FadeInView';
import { Typography } from '../../src/constants/Typography';
import { Spacing, Radius } from '../../src/constants/Colors';
import { db } from '../../src/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { PurchaseOrder } from '../../src/types/stock';

export default function LogisticsPO() {
  const { colors } = useTheme();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [regularPOs, setRegularPOs] = useState<PurchaseOrder[]>([]);
  const [urgentPOs, setUrgentPOs] = useState<PurchaseOrder[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch Regular POs
      const regQ = query(collection(db, 'purchase_orders'), where('status', 'in', ['PENDING', 'PARTIAL']));
      const regSnap = await getDocs(regQ);
      const allData: PurchaseOrder[] = [];
      regSnap.forEach(d => allData.push({ id: d.id, ...d.data() } as unknown as PurchaseOrder));
      
      const sortPOs = (a: PurchaseOrder, b: PurchaseOrder) => {
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
      };

      const regularData = allData.filter(po => po.type === 'REGULAR' || !po.type);
      const urgentData = allData.filter(po => po.type === 'URGENT');

      regularData.sort(sortPOs);
      urgentData.sort(sortPOs);
      
      setRegularPOs(regularData);
      setUrgentPOs(urgentData);
    } catch (error) {
      console.error('Error fetching POs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const SkeletonCard = () => (
    <AppCard style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.skeletonHeader}>
        <View style={[styles.skeletonBlock, { width: 120, height: 24, backgroundColor: colors.border }]} />
        <View style={[styles.skeletonBlock, { width: 60, height: 24, backgroundColor: colors.border }]} />
      </View>
      <View style={[styles.skeletonBlock, { width: 180, height: 16, backgroundColor: colors.border, marginTop: Spacing.m }]} />
    </AppCard>
  );

  return (
    <ScreenContainer padding={false}>
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={[Typography.screenTitle, { color: colors.textPrimary }]}>Daftar Permintaan</Text>
        <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>Permintaan masuk yang perlu diproses</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >


        {/* URGENT PO SECTION */}
        <FadeInView delay={100}>
          <View style={[styles.sectionHeader, { marginTop: Spacing.m }]}>
            <MaterialCommunityIcons name="alert-decagram-outline" size={24} color={colors.outOfStock} style={{ marginRight: Spacing.xs }} />
            <Text style={[Typography.sectionTitle, { color: colors.outOfStock }]}>Urgent PO</Text>
          </View>
        </FadeInView>
        
        {loading ? (
          <>
            <FadeInView delay={150}><SkeletonCard /></FadeInView>
          </>
        ) : urgentPOs.length === 0 ? (
          <FadeInView delay={150}>
            <View style={styles.emptyContainer}>
              <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>Tidak ada permintaan urgent.</Text>
            </View>
          </FadeInView>
        ) : (
          urgentPOs.map((item, index) => (
            <FadeInView key={item.id} delay={150 + (index * 50)}>
              <TouchableOpacity onPress={() => router.push(`/(logistics)/urgent-po/${item.id}`)} activeOpacity={0.8}>
                <AppCard style={[styles.card, { borderColor: 'rgba(255,59,48,0.3)', borderWidth: 1 }]}>
                  <View style={styles.cardHeader}>
                    <Text style={[Typography.cardTitle, { color: colors.outOfStock }]}>
                      UPO-{item.id.substring(0,6).toUpperCase()}
                    </Text>
                    <StatusBadge status={item.status} />
                  </View>
                  <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginTop: Spacing.xs }]}>
                    Tanggal: {item.operational_date}
                  </Text>
                  <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>
                    Oleh: {item.created_by_name || 'Leader Barista'} (Shift {item.source_shift_number})
                  </Text>
                </AppCard>
              </TouchableOpacity>
            </FadeInView>
          ))
        )}

        {/* REGULAR PO SECTION */}
        <FadeInView delay={200}>
          <View style={[styles.sectionHeader, { marginTop: Spacing.xl }]}>
            <MaterialCommunityIcons name="package-variant-closed" size={24} color={colors.primary} style={{ marginRight: Spacing.xs }} />
            <Text style={[Typography.sectionTitle, { color: colors.textPrimary }]}>Regular PO</Text>
          </View>
        </FadeInView>
        
        {loading ? (
          <>
            <FadeInView delay={300}><SkeletonCard /></FadeInView>
            <FadeInView delay={350}><SkeletonCard /></FadeInView>
          </>
        ) : regularPOs.length === 0 ? (
          <FadeInView delay={300}>
            <View style={styles.emptyContainer}>
              <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>Tidak ada permintaan reguler.</Text>
            </View>
          </FadeInView>
        ) : (
          regularPOs.map((item, index) => (
            <FadeInView key={item.id} delay={300 + (index * 50)}>
              <TouchableOpacity onPress={() => router.push(`/(logistics)/regular-po/${item.id}`)} activeOpacity={0.8}>
                <AppCard style={[styles.card, { borderColor: 'rgba(0,122,255,0.2)', borderWidth: 1 }]}>
                  <View style={styles.cardHeader}>
                    <Text style={[Typography.cardTitle, { color: colors.textPrimary }]}>
                      PO-{item.id.substring(0,6).toUpperCase()}
                    </Text>
                    <StatusBadge status={item.status} />
                  </View>
                  <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginTop: Spacing.xs }]}>
                    Tanggal: {item.operational_date}
                  </Text>
                  <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>
                    Oleh: {item.created_by_name || 'Leader Barista'} (Shift {item.source_shift_number})
                  </Text>
                </AppCard>
              </TouchableOpacity>
            </FadeInView>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: Spacing.l,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.m,
  },
  listContent: {
    padding: Spacing.l,
    paddingBottom: Spacing.xxl * 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.m,
  },
  card: {
    marginBottom: Spacing.m,
    padding: Spacing.m,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: Spacing.l,
    alignItems: 'center',
  },
  skeletonBlock: {
    borderRadius: Radius.small,
    opacity: 0.5,
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  }
});
