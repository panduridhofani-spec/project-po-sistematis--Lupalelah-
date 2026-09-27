import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius } from '../../src/constants/Colors';
import { Typography } from '../../src/constants/Typography';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { StatusBadge } from '../../src/components/StatusBadge';
import { AppCard } from '../../src/components/AppCard';
import { FadeInView } from '../../src/components/FadeInView';
import { useTheme } from '../../src/context/ThemeContext';
import { db } from '../../src/lib/firebase';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { getOperationalDate } from '../../src/utils/date';

export default function LogisticsHome() {
  const { colors } = useTheme();
  const router = useRouter();
  
  const operationalDate = React.useMemo(() => getOperationalDate(), []);
  
  const [pendingRegularPOCount, setPendingRegularPOCount] = useState<number>(0);
  const [pendingUrgentPOCount, setPendingUrgentPOCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Regular PO count (type == 'REGULAR' && status == 'PENDING')
      const regQ = query(
        collection(db, 'purchase_orders'),
        where('type', '==', 'REGULAR'),
        where('status', '==', 'PENDING')
      );
      const regSnap = await getCountFromServer(regQ);
      setPendingRegularPOCount(regSnap.data().count);

      // Urgent PO count (type == 'URGENT' && status == 'PENDING')
      const urgQ = query(
        collection(db, 'purchase_orders'),
        where('type', '==', 'URGENT'),
        where('status', '==', 'PENDING')
      );
      const urgSnap = await getCountFromServer(urgQ);
      setPendingUrgentPOCount(urgSnap.data().count);
      
    } catch (error) {
      console.error('Error fetching Logistics dashboard:', error);
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
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        
        {/* Header Section */}
        <FadeInView delay={0}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[Typography.screenTitle, { color: colors.textPrimary, fontWeight: '400', fontSize: 24 }]}>Selamat Pagi,</Text>
              <Text style={[Typography.screenTitle, styles.name, { color: colors.textPrimary }]}>Tim Logistik</Text>
              <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginTop: 4 }]}>
                {(() => {
                  const [yyyy, mm, dd] = operationalDate.split('-');
                  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                  return `${dd} ${months[parseInt(mm, 10) - 1]} ${yyyy}`;
                })()}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
               <TouchableOpacity style={styles.profileIcon} onPress={() => router.push('/(logistics)/profile')}>
                 <MaterialCommunityIcons name="account" size={32} color={colors.textSecondary} />
               </TouchableOpacity>
               <View style={[styles.shiftBadge, { backgroundColor: colors.primaryLight, marginTop: 12 }]}>
                 <Text style={[styles.shiftText, { color: colors.primary }]}>Logistik • Aktif</Text>
               </View>
            </View>
          </View>
        </FadeInView>

        {/* Today's Tasks */}
        <FadeInView delay={100}>
          <Text style={[Typography.sectionTitle, { color: colors.textPrimary, marginBottom: Spacing.m }]}>Tugas Hari Ini</Text>
          <View style={styles.statsColumn}>
            <TouchableOpacity 
              activeOpacity={0.8} 
              style={[styles.statTile, { backgroundColor: colors.primary, marginBottom: Spacing.m }]}
              onPress={() => router.push('/(logistics)/regular-po')}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <View style={styles.statHeader}>
                    <MaterialCommunityIcons name="package-variant-closed" size={24} color="rgba(255,255,255,0.8)" />
                  </View>
                  <Text style={[styles.statNumber, { color: '#FFF' }]}>{pendingRegularPOCount}</Text>
                  <Text style={[Typography.bodyMedium, { color: 'rgba(255,255,255,0.9)', fontWeight: '600' }]}>Regular PO</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              activeOpacity={0.8} 
              style={[styles.statTile, { backgroundColor: colors.outOfStock }]}
              onPress={() => router.push('/(logistics)/urgent-po')}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <View style={styles.statHeader}>
                    <MaterialCommunityIcons name="alert-decagram-outline" size={24} color="rgba(255,255,255,0.8)" />
                  </View>
                  <Text style={[styles.statNumber, { color: '#FFF' }]}>{pendingUrgentPOCount}</Text>
                  <Text style={[Typography.bodyMedium, { color: 'rgba(255,255,255,0.9)', fontWeight: '600' }]}>Urgent PO</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </FadeInView>

        {/* Quick Actions */}
        <FadeInView delay={200}>
          <Text style={[Typography.sectionTitle, { color: colors.textPrimary, marginTop: Spacing.xl, marginBottom: Spacing.m }]}>
            Akses Cepat
          </Text>
          
          {/* Urgent PO Action Card Hidden
          <AppCard style={[styles.actionCard, { borderColor: 'rgba(255, 59, 48, 0.3)', borderWidth: 1 }]}>
            <View style={styles.actionHeader}>
              <View style={[styles.iconWrapper, { backgroundColor: colors.outOfStockLight }]}>
                <MaterialCommunityIcons name="truck-fast" size={28} color={colors.outOfStock} />
              </View>
              <View style={styles.actionTextContent}>
                <Text style={[Typography.cardTitle, { color: colors.textPrimary }]}>PO Darurat (Urgent)</Text>
                <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>Penerimaan stok di luar jadwal</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.processBtn, { backgroundColor: colors.outOfStock }]}
              onPress={() => router.push('/(logistics)/urgent-po')}
            >
              <Text style={styles.processBtnText}>Proses Sekarang</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#FFF" />
            </TouchableOpacity>
          </AppCard>
          */}

          <AppCard style={[styles.actionCard, { borderColor: 'rgba(0, 122, 255, 0.2)', borderWidth: 1 }]}>
            <View style={styles.actionHeader}>
              <View style={[styles.iconWrapper, { backgroundColor: colors.primaryLight }]}>
                <MaterialCommunityIcons name="truck-outline" size={28} color={colors.primary} />
              </View>
              <View style={styles.actionTextContent}>
                <Text style={[Typography.cardTitle, { color: colors.textPrimary }]}>PO Reguler</Text>
                <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>Penerimaan stok terjadwal harian</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.processBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(logistics)/regular-po')}
            >
              <Text style={styles.processBtnText}>Proses Sekarang</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#FFF" />
            </TouchableOpacity>
          </AppCard>
        </FadeInView>

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: Spacing.l,
    paddingBottom: Spacing.xxl * 2,
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
  statsColumn: {
    flexDirection: 'column',
  },
  statTile: {
    padding: Spacing.l,
    borderRadius: Radius.large,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: Spacing.s,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: Spacing.xs,
  },
  actionCard: {
    padding: Spacing.m,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.m,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.m,
  },
  actionTextContent: {
    flex: 1,
  },
  processBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Radius.medium,
  },
  processBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginRight: Spacing.xs,
  },
});
