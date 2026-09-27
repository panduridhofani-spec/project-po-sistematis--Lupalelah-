import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { SettingItem } from '../../src/components/SettingItem';
import { SectionHeader } from '../../src/components/SectionHeader';
import { Typography } from '../../src/constants/Typography';
import { Spacing } from '../../src/constants/Colors';
import { AppAlert } from '../../src/components/AppAlert';

export default function AdminProfile() {
  const { colors, mode, setMode } = useTheme();
  const { profile, signOut } = useAuth();

  const handleToggleTheme = () => {
    if (mode === 'light') setMode('dark');
    else if (mode === 'dark') setMode('system');
    else setMode('light');
  };

  return (
    <ScreenContainer padding={false}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={[Typography.screenTitle, { color: colors.surface }]}>
              {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'A'}
            </Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={[Typography.screenTitle, { color: colors.textPrimary }]}>
              {profile?.full_name || 'Admin'}
            </Text>
            <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>
              {profile?.role === 'MASTER_ADMIN' ? 'Master Admin' : profile?.role}
            </Text>
          </View>
        </View>

        <View style={styles.sectionWrapper}>
          <SectionHeader title="Account" />
        </View>
        <View style={styles.group}>
          <SettingItem icon="user" title="Account Information" onPress={() => {}} />
          <SettingItem icon="users" title="Manage Users" onPress={() => {}} />
          <SettingItem icon="clock" title="Pengaturan Jadwal Shift" onPress={() => router.push('/(admin)/shifts')} />
          <SettingItem icon="shield" title="Role & Permissions" subtitle="Master Admin" />
        </View>

        <View style={styles.sectionWrapper}>
          <SectionHeader title="Preferences" />
        </View>
        <View style={styles.group}>
          <SettingItem 
            icon={mode === 'dark' ? 'moon' : mode === 'light' ? 'sun' : 'smartphone'} 
            title="Appearance" 
            subtitle={`Current: ${mode.charAt(0).toUpperCase() + mode.slice(1)}`}
            onPress={handleToggleTheme} 
          />
          <SettingItem icon="bell" title="Notifications" onPress={() => {}} />
        </View>

        <View style={styles.sectionWrapper}>
          <SectionHeader title="About" />
        </View>
        <View style={styles.group}>
          <SettingItem icon="info" title="App Version" subtitle="1.0.0 (Build 42)" />
          <SettingItem icon="lock" title="Privacy Policy" onPress={() => {}} />
        </View>

        <View style={styles.sectionWrapper}>
          <SectionHeader title="Actions" />
        </View>
        <View style={styles.group}>
          <SettingItem 
            icon="log-out" 
            title="Logout" 
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
