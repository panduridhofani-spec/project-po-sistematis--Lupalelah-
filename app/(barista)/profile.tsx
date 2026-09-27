import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { db } from '../../src/lib/firebase';
import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { SettingItem } from '../../src/components/SettingItem';
import { SectionHeader } from '../../src/components/SectionHeader';
import { FadeInView } from '../../src/components/FadeInView';
import { Typography } from '../../src/constants/Typography';
import { Spacing } from '../../src/constants/Colors';
import { useAuth } from '../../src/context/AuthContext';
import { AppAlert } from '../../src/components/AppAlert';
import { getOperationalDate } from '../../src/utils/date';

export default function BaristaProfile() {
  const { mode, setMode, colors } = useTheme();
  const { profile, activeLeader, activeShift, setActiveShift, setActiveLeader, signOut } = useAuth();
  const [endingShift, setEndingShift] = useState(false);

  const handleEndShift = async () => {
    if (activeShift === null) return;
    
    setEndingShift(true);
    try {
      const operationalDate = getOperationalDate();

      const q = query(
        collection(db, 'stock_takings'),
        where('operational_date', '==', operationalDate),
        where('shift_number', '==', activeShift)
      );
      
      const snap = await getDocs(q);
      
      if (snap.empty) {
        AppAlert.show(
          'Tidak Bisa Menutup Shift',
          'Anda harus menyelesaikan "Cek Stok Penutup" terlebih dahulu. Semua barang wajib diinput!'
        );
      } else {
        AppAlert.show(
          'Tutup Shift',
          'Apakah Anda yakin ingin menutup shift ini? Anda akan kembali ke layar pemilihan shift.',
          [
            { text: 'Batal', style: 'cancel' },
            { 
              text: 'Ya, Tutup', 
              style: 'destructive',
              onPress: async () => {
                await setActiveShift(null);
                await setActiveLeader(null);
              }
            }
          ]
        );
      }
    } catch (e) {
      console.error(e);
      AppAlert.show('Error', 'Gagal memvalidasi status stok penutup.');
    } finally {
      setEndingShift(false);
    }
  };

  const handleToggleTheme = () => {
    if (mode === 'light') setMode('dark');
    else if (mode === 'dark') setMode('system');
    else setMode('light');
  };

  const getThemeText = () => {
    if (mode === 'light') return 'Terang';
    if (mode === 'dark') return 'Gelap';
    return 'Sistem';
  };

  return (
    <ScreenContainer padding={false}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Profile Header */}
        <FadeInView delay={0}>
          <View style={styles.header}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={[Typography.screenTitle, { color: colors.surface }]}>
                {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'B'}
              </Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={[Typography.screenTitle, { color: colors.textPrimary }]}>
                {activeLeader?.full_name || profile?.full_name || 'Leader Barista'}
              </Text>
              <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>
                {activeShift ? `Shift ${activeShift}` : 'Shift Belum Ditentukan'}
              </Text>
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={100}>
          <View style={styles.sectionWrapper}>
            <SectionHeader title="Akun" />
          </View>
          <View style={styles.group}>
            <SettingItem icon="user" title="Informasi Akun" onPress={() => {}} />
            <SettingItem icon="clock" title="Jadwal Shift" onPress={() => {}} />
            <SettingItem icon="shield" title="Peran & Izin" subtitle="Leader Barista" />
          </View>
        </FadeInView>

        <FadeInView delay={200}>
          <View style={styles.sectionWrapper}>
            <SectionHeader title="Preferensi" />
          </View>
          <View style={styles.group}>
            <SettingItem 
              icon={mode === 'dark' ? 'moon' : mode === 'light' ? 'sun' : 'smartphone'} 
              title="Tampilan" 
              subtitle={`Saat ini: ${getThemeText()}`}
              onPress={handleToggleTheme} 
            />
            <SettingItem icon="bell" title="Notifikasi" onPress={() => {}} />
          </View>
        </FadeInView>

        <FadeInView delay={300}>
          <View style={styles.sectionWrapper}>
            <SectionHeader title="Tentang" />
          </View>
          <View style={styles.group}>
            <SettingItem icon="info" title="Versi Aplikasi" subtitle="1.0.0 (Build 42)" />
            <SettingItem icon="lock" title="Kebijakan Privasi" onPress={() => {}} />
          </View>
        </FadeInView>

        <FadeInView delay={400}>
          <View style={styles.sectionWrapper}>
            <SectionHeader title="Aksi" />
          </View>
          <View style={styles.group}>
            {endingShift ? (
              <View style={{ padding: Spacing.l, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ marginTop: 8, color: colors.textSecondary }}>Memproses...</Text>
              </View>
            ) : (
              <SettingItem 
                icon="x-square" 
                title="Tutup Shift" 
                onPress={handleEndShift} 
              />
            )}
            
            <SettingItem 
              icon="log-out" 
              title="Keluar / Logout Aplikasi" 
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
              isDanger 
            />
          </View>
        </FadeInView>

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.l,
    marginBottom: Spacing.m,
  },
  sectionWrapper: {
    paddingHorizontal: Spacing.l,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.l,
  },
  headerInfo: {
    flex: 1,
  },
  group: {
    marginBottom: Spacing.l,
  },
});
