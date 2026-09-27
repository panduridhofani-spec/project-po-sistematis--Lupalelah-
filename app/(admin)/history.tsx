import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Spacing, Radius } from '../../src/constants/Colors';
import { Typography } from '../../src/constants/Typography';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { AppCard } from '../../src/components/AppCard';
import { FadeInView } from '../../src/components/FadeInView';
import { useTheme } from '../../src/context/ThemeContext';

export default function HistoryScreen() {
  const { colors } = useTheme();

  return (
    <ScreenContainer padding={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={[Typography.screenTitle, { color: colors.textPrimary }]}>Riwayat (Audit Trail)</Text>
          <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>Pantauan Jejak Sistem</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <FadeInView delay={100}>
          <AppCard style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.s }}>
              <View style={[styles.badge, { backgroundColor: colors.safe + '20' }]}>
                <Text style={[styles.badgeText, { color: colors.safe }]}>VALIDASI SELESAI</Text>
              </View>
              <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>Baru saja</Text>
            </View>
            <Text style={[Typography.cardTitle, { color: colors.textPrimary }]}>Shift 3 Menerima PO</Text>
            <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginTop: 4 }]}>
              Barista Leader Shift 3 memvalidasi kedatangan PO-Reguler dengan 0 selisih barang.
            </Text>
          </AppCard>
        </FadeInView>

        <FadeInView delay={150}>
          <AppCard style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.s }}>
              <View style={[styles.badge, { backgroundColor: colors.needPo + '20' }]}>
                <Text style={[styles.badgeText, { color: colors.needPo }]}>PO BARU</Text>
              </View>
              <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>2 jam yang lalu</Text>
            </View>
            <Text style={[Typography.cardTitle, { color: colors.textPrimary }]}>PO URGENT Dibuat</Text>
            <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginTop: 4 }]}>
              Shift 2 mengajukan PO URGENT untuk 2 item (Beras, Gula).
            </Text>
          </AppCard>
        </FadeInView>

        <Text style={[Typography.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.xl }]}>
          Catatan Jejak Digital sedang dimuat...
        </Text>

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.l,
    paddingTop: Spacing.xl,
  },
  backButton: {
    marginRight: Spacing.m,
  },
  scrollContent: {
    padding: Spacing.l,
    paddingBottom: Spacing.xxl,
  },
  card: {
    marginBottom: Spacing.m,
    padding: Spacing.m,
  },
  badge: {
    paddingHorizontal: Spacing.s,
    paddingVertical: 4,
    borderRadius: Radius.small,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  }
});
