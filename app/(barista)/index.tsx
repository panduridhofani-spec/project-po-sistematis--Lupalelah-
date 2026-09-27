import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Animated, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Spacing } from '../../src/constants/Colors';
import { Typography } from '../../src/constants/Typography';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { StatusBadge } from '../../src/components/StatusBadge';
import { AppCard } from '../../src/components/AppCard';
import { StatCard } from '../../src/components/StatCard';
import { QuickActionCard } from '../../src/components/QuickActionCard';
import { SectionHeader } from '../../src/components/SectionHeader';
import { ProgressCard } from '../../src/components/ProgressCard';
import { FadeInView } from '../../src/components/FadeInView';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { db } from '../../src/lib/firebase';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { getOperationalDate } from '../../src/utils/date';

export default function BaristaHome() {
  const { colors } = useTheme();
  const router = useRouter();
  
  const { activeShift, activeLeader } = useAuth();
  
  const [isStockTakingDone, setIsStockTakingDone] = useState<boolean | null>(null);
  const [recentPO, setRecentPO] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Real data state
  const [stockSummary, setStockSummary] = useState({ aman: 0, perluPo: 0, habis: 0 });
  const [stockProgress, setStockProgress] = useState({ percentage: 0, filled: 0, remaining: 0 });
  
  // Animation for Login Toast
  const [showToast, setShowToast] = useState(true);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const translateY = useState(new Animated.Value(-20))[0];
  
  const currentShift = activeShift || 1; // Fallback if activeShift is missing
  const [operationalDate, setOperationalDate] = useState(() => getOperationalDate());

  const isPoAllowed = currentShift === 2 || currentShift === 4;

  useFocusEffect(
    useCallback(() => {
      const newDate = getOperationalDate();
      setOperationalDate(newDate);
      fetchDashboardData(newDate);
    }, [currentShift])
  );

  useEffect(() => {
    // Animate Toast In
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();

    // Hide Toast after 4 seconds
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setShowToast(false));
    }, 4000);

    return () => clearTimeout(timer);
  }, [currentShift]);

  const fetchDashboardData = async (dateStr: string) => {
    try {
      // 1. Fetch products & compute base summary
      const prodSnap = await getDocs(collection(db, 'products'));
      let aman = 0;
      let perluPo = 0;
      let habis = 0;
      const totalProducts = prodSnap.size;
      
      const draftKey = `draft_stock_${currentShift}_${dateStr}`;
      const draftStr = await AsyncStorage.getItem(draftKey);
      let draft: any = {};
      if (draftStr) {
        try { draft = JSON.parse(draftStr); } catch (e) {}
      }

      // 2. Fetch pending tasks (Stock Taking)
      const stockQ = query(
        collection(db, 'stock_takings'),
        where('operational_date', '==', dateStr),
        where('shift_number', '==', currentShift),
        limit(1)
      );
      const stockSnap = await getDocs(stockQ);
      const isDone = !stockSnap.empty;
      setIsStockTakingDone(isDone);
      
      let stockTakingItems: Record<string, any> = {};
      if (isDone) {
        const stData = stockSnap.docs[0].data();
        if (stData.items && Array.isArray(stData.items)) {
          stData.items.forEach((item: any) => {
            stockTakingItems[item.product_id] = item;
          });
        }
      }

      prodSnap.forEach(doc => {
        const p = doc.data();
        let actual = p.actual_stock || 0;
        const safety = p.safety_stock || 0;
        
        if (isDone && stockTakingItems[doc.id]) {
          // If stock taking is done, use the recorded actual stock
          actual = stockTakingItems[doc.id].actual_stock || 0;
        } else if (draft[doc.id] && draft[doc.id].end !== '') {
          // Otherwise use draft if available
          actual = parseInt(draft[doc.id].end, 10) || 0;
        }
        
        if (actual === 0) habis++;
        else if (actual < safety) perluPo++;
        else aman++;
      });
      setStockSummary({ aman, perluPo, habis });

      if (isDone) {
        setStockProgress({ percentage: 100, filled: totalProducts, remaining: 0 });
      } else {
        // Compute progress from draft
        const filled = Object.values(draft).filter((item: any) => item.end !== '' && item.out !== '').length;
        const remaining = Math.max(0, totalProducts - filled);
        const percentage = totalProducts === 0 ? 0 : Math.round((filled / totalProducts) * 100);
        setStockProgress({ percentage, filled, remaining });
      }

      // 3. Fetch most recent PO
      // Note: user.uid is available via useAuth() but we don't have it directly here.
      // We will skip user filter for now and just fetch recent PO for the shift
      const poQ = query(
        collection(db, 'purchase_orders'),
        where('source_shift_number', '==', currentShift),
        where('operational_date', '==', dateStr),
        limit(1)
      );
      const poSnap = await getDocs(poQ);
      if (!poSnap.empty) {
        const poData = { id: poSnap.docs[0].id, ...poSnap.docs[0].data() };
        setRecentPO(poData);
      } else {
        setRecentPO(null);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  return (
    <ScreenContainer padding={false}>
      {/* Animated Login Toast */}
      {showToast && (
        <Animated.View style={[
          styles.toastContainer, 
          { 
            backgroundColor: '#1C1C1E', // Premium dark background
            opacity: fadeAnim,
            transform: [{ translateY }]
          }
        ]}>
          <View style={styles.toastIconWrapper}>
            <Feather name="check" size={16} color="#FFFFFF" />
          </View>
          <Text style={[Typography.bodyMedium, { color: '#FFFFFF', fontWeight: '600' }]}>
            Berhasil login sebagai Leader Shift {currentShift}
          </Text>
        </Animated.View>
      )}

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        
        {/* Header Section */}
        <FadeInView delay={0}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[Typography.screenTitle, { color: colors.textPrimary, fontWeight: '400', fontSize: 24 }]}>Selamat Pagi,</Text>
              <Text style={[Typography.screenTitle, styles.name, { color: colors.textPrimary }]}>{activeLeader?.full_name || 'Leader Barista'}</Text>
              <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginTop: 4 }]}>
                {(() => {
                  const [yyyy, mm, dd] = operationalDate.split('-');
                  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                  return `${dd} ${months[parseInt(mm, 10) - 1]} ${yyyy}`;
                })()}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
               <TouchableOpacity style={styles.profileIcon} onPress={() => router.push('/(barista)/profile')}>
                 <Feather name="user" size={32} color={colors.textSecondary} />
               </TouchableOpacity>
               <View style={[styles.shiftBadge, { backgroundColor: colors.primaryLight, marginTop: 12 }]}>
                 <Text style={[styles.shiftText, { color: colors.primary }]}>Shift {currentShift} • Aktif</Text>
               </View>
            </View>
          </View>
        </FadeInView>

        {/* Today's Progress */}
        <FadeInView delay={100}>
          <SectionHeader title="Progres Hari Ini" />
          <ProgressCard 
            title="Stock Opname" 
            percentage={stockProgress.percentage} 
            subtitle={`${stockProgress.filled} selesai, ${stockProgress.remaining} tersisa`} 
          />
        </FadeInView>

        {/* Today's Stock Overview */}
        <FadeInView delay={200}>
          <SectionHeader title="Ringkasan Stok" />
          <View style={styles.statsRow}>
            <StatCard number={stockSummary.aman} label="Aman" color={colors.safe} bgColor={(colors as any).safeLight} icon="check-circle" />
            <StatCard number={stockSummary.perluPo} label="Perlu PO" color={colors.needPo} bgColor={(colors as any).needPoLight} icon="alert" />
            <StatCard number={stockSummary.habis} label="Habis" color={colors.outOfStock} bgColor={(colors as any).outOfStockLight} icon="alert-circle" />
          </View>
        </FadeInView>

        {/* Quick Actions */}
        <FadeInView delay={300}>
          <SectionHeader title="Aksi Cepat" />
          <View style={styles.actionsRow}>
            <QuickActionCard 
              title="Stock & PO" 
              icon={<Feather name="search" size={24} color={colors.primary} />}
              onPress={() => router.push('/(barista)/stock-taking')}
              accent
              style={{ flex: 1, marginHorizontal: 4 }}
            />
            <QuickActionCard 
              title="PO\nUrgent" 
              icon={<Feather name="alert-circle" size={24} color={colors.outOfStock} />}
              onPress={() => router.push('/(barista)/urgent-po')}
              danger
              style={{ flex: 1, marginHorizontal: 4 }}
            />
          </View>
        </FadeInView>

        {/* Pending Tasks */}
        <FadeInView delay={400}>
          <SectionHeader title={isStockTakingDone ? "Tugas Selesai" : "Tugas Tertunda"} />
          <AppCard>
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <TouchableOpacity 
                style={styles.taskRow} 
                onPress={() => router.push('/(barista)/stock-taking')}
              >
                <View style={[styles.taskIconContainer, { backgroundColor: isStockTakingDone ? colors.safeLight : colors.needPoLight }]}>
                  <Feather 
                    name={isStockTakingDone ? "check-circle" : "alert-circle"} 
                    size={20} 
                    color={isStockTakingDone ? colors.safe : colors.needPo} 
                  />
                </View>
                <View style={styles.taskContent}>
                  <Text style={[Typography.cardTitle, { color: colors.textPrimary }]}>Cek Stok Penutup</Text>
                  <Text style={[Typography.bodySecondary, { color: colors.textSecondary }]}>
                    {isStockTakingDone 
                      ? `Cek stok penutup Shift ${currentShift} telah selesai.` 
                      : `Cek stok penutup Shift ${currentShift} belum diselesaikan.`}
                  </Text>
                </View>
                <Feather name="arrow-right" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}
          </AppCard>
        </FadeInView>

        {/* Recent PO */}
        {isPoAllowed && (
          <FadeInView delay={500}>
            <SectionHeader title="PO Terakhir" />
            <AppCard>
              {loading ? (
                 <ActivityIndicator size="small" color={colors.primary} />
              ) : recentPO ? (
                <TouchableOpacity style={styles.poRow} onPress={() => router.push(`/(barista)/regular-po/${recentPO.id}`)}>
                  <View>
                    <Text style={[Typography.cardTitle, { color: colors.textPrimary }]}>
                      PO-{recentPO.id.split('-')[0].toUpperCase()}
                    </Text>
                    <Text style={[Typography.bodySecondary, { color: colors.textSecondary }]}>
                      {(recentPO.items && recentPO.items.length) || 0} item diajukan
                    </Text>
                  </View>
                  <StatusBadge status={recentPO.status} />
                </TouchableOpacity>
              ) : (
                <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>Belum ada PO dibuat.</Text>
              )}
            </AppCard>
          </FadeInView>
        )}

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: Spacing.l,
    paddingBottom: Spacing.xxl,
  },
  toastContainer: {
    position: 'absolute',
    top: Spacing.xl + Spacing.m,
    alignSelf: 'center',
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30, // Pill shape
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  toastIconWrapper: {
    backgroundColor: '#34C759', // Green circle
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.s,
  },
  header: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.m,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  name: {
    marginTop: 4,
  },
  profileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8E1DA',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  shiftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.m,
    paddingVertical: 6,
    borderRadius: 16,
  },
  shiftText: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.l,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.m,
  },
  taskContent: {
    flex: 1,
    marginRight: Spacing.m,
  },
  poRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  }
});

