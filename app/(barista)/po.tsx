import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { FilterChip } from '../../src/components/FilterChip';
import { TaskCard } from '../../src/components/TaskCard';
import { AppCard } from '../../src/components/AppCard';
import { StatCard } from '../../src/components/StatCard';
import { FadeInView } from '../../src/components/FadeInView';
import { Typography } from '../../src/constants/Typography';
import { Spacing } from '../../src/constants/Colors';
import { useAuth } from '../../src/context/AuthContext';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '../../src/components/AppButton';
import { useRouter, useFocusEffect } from 'expo-router';
import { db } from '../../src/lib/firebase';
import { collection, query, orderBy, getDocs, onSnapshot, where } from 'firebase/firestore';
import { PurchaseOrder } from '../../src/types/stock';
import { AppAlert } from '../../src/components/AppAlert';

type POFilter = 'Semua' | 'Reguler' | 'Mendesak';

export default function POScreen() {
  const { colors } = useTheme();
  const { activeShift } = useAuth();
  const router = useRouter();
  
  const [filter, setFilter] = useState<POFilter>('Semua');
  const filters: POFilter[] = ['Semua', 'Reguler', 'Mendesak'];

  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const currentShift = activeShift || 1;

  useEffect(() => {

    setLoading(true);
    const q = query(collection(db, 'purchase_orders'), orderBy('created_at', 'desc'));
    
    const unsubscribe = onSnapshot(q, async (snap) => {
      try {
        const poData: PurchaseOrder[] = [];
        for (const document of snap.docs) {
          const data = document.data() as PurchaseOrder;
          
          // Get items count
          if (!data.items || data.items.length === 0) {
            const itemsQ = query(collection(db, 'purchase_order_items'), where('purchase_order_id', '==', document.id));
            const itemsSnap = await getDocs(itemsQ);
            data.items = itemsSnap.docs.map(doc => doc.data() as any);
          }
          // Hide COMPLETE or VALIDATED POs older than 24 hours from completion
          if (data.status === 'COMPLETE' || data.status === 'VALIDATED') {
            const completedAt = new Date(data.updated_at || data.created_at || new Date().toISOString()).getTime();
            const now = Date.now();
            const hours24 = 24 * 60 * 60 * 1000;
            if (now - completedAt > hours24) {
              continue; // Skip this PO
            }
          }
          
          poData.push({ id: document.id, ...data });
        }
        setPos(poData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error(error);
      AppAlert.show('Error', 'Gagal memuat daftar PO');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const onRefresh = () => {
    // onSnapshot is already real-time, but we can keep the pull-to-refresh for UX
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const filteredPOs = pos.filter(po => {
    if (filter === 'Reguler') return po.type === 'REGULAR';
    if (filter === 'Mendesak') return po.type === 'URGENT';
    return true;
  });

  const activePOs = filteredPOs.filter(po => po.status !== 'COMPLETE' && po.status !== 'VALIDATED');
  const completedPOs = filteredPOs.filter(po => po.status === 'COMPLETE' || po.status === 'VALIDATED');

  const pendingCount = pos.filter(po => po.status === 'PENDING').length;
  const processingCount = pos.filter(po => po.status === 'SENT' || po.status === 'PARTIAL').length;
  const completedCount = pos.filter(po => po.status === 'COMPLETE' || po.status === 'VALIDATED').length;

  return (
    <ScreenContainer padding={false}>
      <FadeInView delay={0}>
        <View style={styles.header}>
          <Text style={[Typography.screenTitle, { color: colors.textPrimary, marginBottom: Spacing.m }]}>Purchase Orders</Text>
          
          <View style={styles.summaryRow}>
            <AppCard style={styles.summaryCard}>
              <StatCard number={pendingCount} label="Menunggu" />
            </AppCard>
            <View style={{ width: Spacing.s }} />
            <AppCard style={styles.summaryCard}>
              <StatCard number={processingCount} label="Diproses" color={colors.primary} />
            </AppCard>
            <View style={{ width: Spacing.s }} />
            <AppCard style={styles.summaryCard}>
              <StatCard number={completedCount} label="Selesai" color={colors.safe} />
            </AppCard>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {filters.map(f => (
              <FilterChip 
                key={f}
                label={f}
                active={filter === f}
                onPress={() => setFilter(f)}
              />
            ))}
          </ScrollView>
        </View>
      </FadeInView>

      <ScrollView 
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: Spacing.xl }} />
        ) : (
          <>
            {activePOs.length > 0 && (
              <FadeInView delay={100}>
                <Text style={[Typography.sectionTitle, { color: colors.textPrimary, marginBottom: Spacing.m }]}>Permintaan Aktif</Text>
              </FadeInView>
            )}
            
            {activePOs.map((po, index) => {
              const isUrgent = po.type === 'URGENT';
              let dateStr = '-';
              if (po.created_at) {
                const d = new Date(po.created_at);
                const day = d.getDate().toString().padStart(2, '0');
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                const month = monthNames[d.getMonth()];
                const year = d.getFullYear();
                const hours = d.getHours().toString().padStart(2, '0');
                const minutes = d.getMinutes().toString().padStart(2, '0');
                dateStr = `${day} ${month} ${year}, ${hours}:${minutes}`;
              }
              const leaderName = po.requested_by_name || (po as any).created_by_name || po.requested_by || 'Leader Shift ' + po.source_shift_number;
              const itemCount = po.items?.length || 0;

              return (
                <FadeInView delay={150 + index * 50} key={po.id}>
                  <TaskCard 
                    title={po.id} 
                    subtitle={`PO ${isUrgent ? 'Mendesak' : 'Reguler'} · ${itemCount} item\nOleh: ${leaderName}\n${dateStr}`}
                    icon={isUrgent ? 'alert-circle' : 'file-text'}
                    iconColor={isUrgent ? colors.outOfStock : (po.status === 'PENDING' ? colors.needPo : colors.primary)}
                    onPress={() => {
                      if (isUrgent) {
                        router.push(`/(barista)/urgent-po/${po.id}`);
                      } else {
                        router.push(`/(barista)/regular-po/${po.id}`);
                      }
                    }}
                  />
                </FadeInView>
              );
            })}

            {activePOs.length === 0 && completedPOs.length === 0 && (
              <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
                <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>Tidak ada data PO.</Text>
              </View>
            )}

            {completedPOs.length > 0 && (
              <FadeInView delay={300}>
                <Text style={[Typography.sectionTitle, { color: colors.textPrimary, marginTop: Spacing.l, marginBottom: Spacing.m }]}>Selesai</Text>
              </FadeInView>
            )}
            
            {completedPOs.map((po, index) => {
              const isUrgent = po.type === 'URGENT';
              let dateStr = '-';
              if (po.created_at) {
                const d = new Date(po.created_at);
                const day = d.getDate().toString().padStart(2, '0');
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                const month = monthNames[d.getMonth()];
                const year = d.getFullYear();
                const hours = d.getHours().toString().padStart(2, '0');
                const minutes = d.getMinutes().toString().padStart(2, '0');
                dateStr = `${day} ${month} ${year}, ${hours}:${minutes}`;
              }
              const leaderName = po.requested_by_name || (po as any).created_by_name || po.requested_by || 'Leader Shift ' + po.source_shift_number;
              const itemCount = po.items?.length || 0;

              return (
                <FadeInView delay={350 + index * 50} key={po.id}>
                  <TaskCard 
                    title={po.id} 
                    subtitle={`PO ${isUrgent ? 'Mendesak' : 'Reguler'} · ${itemCount} item\nOleh: ${leaderName}\n${dateStr}`}
                    completed
                    onPress={() => {
                      if (isUrgent) {
                        router.push(`/(barista)/urgent-po/${po.id}`);
                      } else {
                        router.push(`/(barista)/regular-po/${po.id}`);
                      }
                    }}
                  />
                </FadeInView>
              );
            })}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: Spacing.l,
    paddingBottom: 0,
  },
  restrictedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.m,
  },
  summaryCard: {
    flex: 1,
    paddingVertical: Spacing.m,
    paddingHorizontal: Spacing.xs,
  },
  chipRow: {
    marginBottom: Spacing.m,
  },
  listContent: {
    padding: Spacing.l,
    paddingBottom: Spacing.xxl,
  },
});
