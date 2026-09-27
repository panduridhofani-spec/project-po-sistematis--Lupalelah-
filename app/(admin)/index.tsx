import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Spacing } from '../../src/constants/Colors';
import { Typography } from '../../src/constants/Typography';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { AppCard } from '../../src/components/AppCard';
import { StatCard } from '../../src/components/StatCard';
import { SectionHeader } from '../../src/components/SectionHeader';
import { AppButton } from '../../src/components/AppButton';
import { FadeInView } from '../../src/components/FadeInView';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { AppAlert } from '../../src/components/AppAlert';
import { db } from '../../src/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function AdminDashboard() {
  const { colors } = useTheme();
  const { signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    products: 0,
    users: 0,
    alerts: 0
  });

  const fetchStats = async () => {
    try {
      const [prodSnap, userSnap] = await Promise.all([
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'users'))
      ]);
      setStats({
        products: prodSnap.size,
        users: userSnap.size,
        alerts: 0 // Placeholder until live tracking is built
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  return (
    <ScreenContainer padding={false}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        
        {/* Header Section */}
        <FadeInView delay={0}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[Typography.screenTitle, { color: colors.textSecondary, fontWeight: '400', fontSize: 16 }]}>Selamat Datang,</Text>
              <Text style={[Typography.screenTitle, styles.name, { color: colors.primary }]}>Master Manager 👑</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
               <TouchableOpacity style={[styles.profileIcon, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]} onPress={() => router.push('/(admin)/profile')}>
                 <Feather name="user" size={24} color={colors.textPrimary} />
               </TouchableOpacity>
               <View style={[styles.shiftBadge, { backgroundColor: colors.safe + '20', borderColor: colors.safe, marginTop: 12 }]}>
                 <Text style={[styles.shiftText, { color: colors.safe }]}>SYSTEM • SECURE</Text>
               </View>
            </View>
          </View>
        </FadeInView>

        {/* Overview Stats */}
        <SectionHeader title="Monitor Pusat" />
        <View style={styles.statsRow}>
          <StatCard number={stats.products} label="Total Produk" color={colors.primary} bgColor={colors.primary + '20'} icon="package-variant" />
          <StatCard number={stats.users} label="Karyawan" color={colors.safe} bgColor={colors.safe + '20'} icon="account-group" />
          <StatCard number={stats.alerts} label="Peringatan" color={colors.outOfStock} bgColor={colors.outOfStock + '20'} icon="alert" />
        </View>

        {/* Recent Activity */}
        <SectionHeader title="Aktivitas Terkini" />
        <AppCard>
          <View style={styles.activityItem}>
            <View style={[styles.activityIcon, { backgroundColor: colors.primaryLight }]}>
              <Feather name="box" size={16} color={colors.primary} />
            </View>
            <View style={styles.activityContent}>
              <Text style={[Typography.bodyMedium, { color: colors.textPrimary }]}>Shift 2 menyelesaikan cek stok</Text>
              <Text style={[Typography.bodySecondary, { color: colors.textSecondary }]}>10 menit yang lalu</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.activityItem}>
            <View style={[styles.activityIcon, { backgroundColor: colors.needPoLight }]}>
              <Feather name="file-text" size={16} color={colors.needPo} />
            </View>
            <View style={styles.activityContent}>
              <Text style={[Typography.bodyMedium, { color: colors.textPrimary }]}>Permintaan PO baru dibuat</Text>
              <Text style={[Typography.bodySecondary, { color: colors.textSecondary }]}>2 jam yang lalu</Text>
            </View>
          </View>
        </AppCard>

        {/* Quick Links */}
        <SectionHeader title="Sistem Master" />
        
        {/* ROW 1 */}
        <View style={{ flexDirection: 'row', gap: Spacing.m, marginBottom: Spacing.m }}>
          <AppCard onPress={() => router.push('/(admin)/products')} style={{ flex: 1, padding: Spacing.m, alignItems: 'center' }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.s }}>
              <Feather name="box" size={24} color={colors.primary} />
            </View>
            <Text style={[Typography.cardTitle, { color: colors.textPrimary, textAlign: 'center' }]}>Produk</Text>
            <Text style={[Typography.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>Kelola Stok & Item</Text>
          </AppCard>
          
          <AppCard onPress={() => router.push('/(admin)/shifts')} style={{ flex: 1, padding: Spacing.m, alignItems: 'center' }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.safe + '20', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.s }}>
              <Feather name="clock" size={24} color={colors.safe} />
            </View>
            <Text style={[Typography.cardTitle, { color: colors.textPrimary, textAlign: 'center' }]}>Waktu Shift</Text>
            <Text style={[Typography.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>Jadwal Operasional</Text>
          </AppCard>
        </View>

        {/* ROW 2 */}
        <View style={{ flexDirection: 'row', gap: Spacing.m, marginBottom: Spacing.m }}>
          <AppCard onPress={() => router.push('/(admin)/users')} style={{ flex: 1, padding: Spacing.m, alignItems: 'center' }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.needPo + '20', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.s }}>
              <Feather name="users" size={24} color={colors.needPo} />
            </View>
            <Text style={[Typography.cardTitle, { color: colors.textPrimary, textAlign: 'center' }]}>Pegawai</Text>
            <Text style={[Typography.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>Kelola Akses Akun</Text>
          </AppCard>
          
          <AppCard onPress={() => router.push('/(admin)/history')} style={{ flex: 1, padding: Spacing.m, alignItems: 'center' }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.textSecondary + '20', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.s }}>
              <Feather name="file-text" size={24} color={colors.textSecondary} />
            </View>
            <Text style={[Typography.cardTitle, { color: colors.textPrimary, textAlign: 'center' }]}>Riwayat (Audit)</Text>
            <Text style={[Typography.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>Jejak Cek & PO</Text>
          </AppCard>
        </View>

        <AppButton 
          title="Keluar (Logout)" 
          variant="secondary"
          onPress={() => {
            AppAlert.show(
              'Konfirmasi Logout',
              'Apakah Anda yakin ingin keluar dari aplikasi?',
              [
                { text: 'Batal', style: 'cancel' },
                { text: 'Ya, Keluar', style: 'destructive', onPress: signOut }
              ]
            );
          }}
          style={styles.logoutButton}
        />

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: Spacing.l,
    paddingBottom: Spacing.xxl,
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
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  shiftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.m,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  shiftText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.m,
  },
  activityContent: {
    flex: 1,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.m,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkIcon: {
    marginRight: Spacing.m,
  },
  linkContent: {
    flex: 1,
  },
  logoutButton: {
    marginTop: Spacing.xxl,
  }
});
