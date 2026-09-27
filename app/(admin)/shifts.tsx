import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { AppCard } from '../../src/components/AppCard';
import { AppButton } from '../../src/components/AppButton';
import { AppTextInput } from '../../src/components/AppTextInput';
import { Typography } from '../../src/constants/Typography';
import { Spacing, Radius } from '../../src/constants/Colors';
import { useTheme } from '../../src/context/ThemeContext';
import { db } from '../../src/lib/firebase';
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { ShiftSchedule } from '../../src/types/shift';
import { AppAlert } from '../../src/components/AppAlert';

export default function ShiftsSettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shifts, setShifts] = useState<ShiftSchedule[]>([]);

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'shift_schedules'));
      const shiftsData: ShiftSchedule[] = [];
      snap.forEach(doc => {
        shiftsData.push({ id: doc.id, ...doc.data() } as unknown as ShiftSchedule);
      });
      shiftsData.sort((a, b) => a.shift_number - b.shift_number);
      
      if (shiftsData.length === 0) {
        // Initialize if empty
        const defaultShifts = [
          { shift_number: 1, start_time: '06:00:00', end_time: '14:30:00', active: true },
          { shift_number: 2, start_time: '14:00:00', end_time: '22:30:00', active: true },
          { shift_number: 3, start_time: '22:00:00', end_time: '06:30:00', active: true },
          { shift_number: 4, start_time: '08:00:00', end_time: '17:00:00', active: true },
        ];
        for (const s of defaultShifts) {
          await setDoc(doc(db, 'shift_schedules', s.shift_number.toString()), s);
          shiftsData.push(s as ShiftSchedule);
        }
      }
      
      setShifts(shiftsData);
    } catch (e: any) {
      console.error('Error fetching shifts:', e);
      AppAlert.show('Error', 'Gagal memuat jadwal shift.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateShift = (index: number, field: 'start_time' | 'end_time', value: string) => {
    const updated = [...shifts];
    updated[index] = { ...updated[index], [field]: value };
    setShifts(updated);
  };

  const validateTimeFormat = (timeStr: string) => {
    return /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/.test(timeStr);
  };

  const handleSave = async () => {
    // Validate
    for (const s of shifts) {
      if (!validateTimeFormat(s.start_time) || !validateTimeFormat(s.end_time)) {
        AppAlert.show('Validasi Gagal', `Format waktu untuk Shift ${s.shift_number} tidak valid. Gunakan format HH:MM (contoh 14:00).`);
        return;
      }
    }

    setSaving(true);
    try {
      // Firebase update
      for (const s of shifts) {
        await setDoc(doc(db, 'shift_schedules', s.shift_number.toString()), {
          shift_number: s.shift_number,
          start_time: s.start_time.length === 5 ? `${s.start_time}:00` : s.start_time,
          end_time: s.end_time.length === 5 ? `${s.end_time}:00` : s.end_time,
          active: s.active
        }, { merge: true });
      }
      
      AppAlert.show('Berhasil', 'Jadwal shift berhasil diperbarui.');
      fetchShifts(); // refresh
    } catch (e: any) {
      console.error('Error saving shifts:', e);
      AppAlert.show('Error', 'Gagal menyimpan perubahan jadwal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer padding={false}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Feather name="arrow-left" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={[Typography.screenTitle, { color: colors.textPrimary }]}>
                Pengaturan Shift
              </Text>
              <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>
                Atur jam kerja untuk setiap shift
              </Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: Spacing.xxl }} />
          ) : shifts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>
                Data shift tidak ditemukan. Pastikan tabel telah dibuat di database.
              </Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              <View style={[styles.infoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Feather name="info" size={20} color={colors.primary} style={{ marginRight: Spacing.s }} />
                <Text style={[Typography.bodySmall, { color: colors.textSecondary, flex: 1 }]}>
                  Gunakan format waktu 24 jam HH:MM (contoh: 06:00, 14:30).
                </Text>
              </View>

              {shifts.map((shift, index) => (
                <AppCard key={shift.shift_number} style={styles.shiftCard}>
                  <View style={styles.shiftHeader}>
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                      <Text style={[Typography.labelSmall, { color: colors.surface }]}>
                        SHIFT {shift.shift_number}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.timeInputsRow}>
                    <View style={styles.inputWrapper}>
                      <AppTextInput
                        label="Jam Mulai"
                        value={shift.start_time.substring(0, 5)} // HH:MM
                        onChangeText={(val) => handleUpdateShift(index, 'start_time', val)}
                        placeholder="00:00"
                        keyboardType="numbers-and-punctuation"
                      />
                    </View>
                    <View style={styles.separator}>
                      <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>-</Text>
                    </View>
                    <View style={styles.inputWrapper}>
                      <AppTextInput
                        label="Jam Selesai"
                        value={shift.end_time.substring(0, 5)}
                        onChangeText={(val) => handleUpdateShift(index, 'end_time', val)}
                        placeholder="00:00"
                        keyboardType="numbers-and-punctuation"
                      />
                    </View>
                  </View>
                </AppCard>
              ))}

              <AppButton
                title={saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                onPress={handleSave}
                disabled={saving}
                style={{ marginTop: Spacing.l }}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: Spacing.l,
    paddingBottom: Spacing.xxl * 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  headerTitleContainer: {
    marginLeft: Spacing.m,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: Spacing.xxl,
  },
  listContainer: {
    width: '100%',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.m,
    borderWidth: 1,
    borderRadius: Radius.medium,
    marginBottom: Spacing.l,
  },
  shiftCard: {
    marginBottom: Spacing.m,
    padding: Spacing.l,
  },
  shiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.m,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.small,
  },
  timeInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputWrapper: {
    flex: 1,
  },
  separator: {
    paddingHorizontal: Spacing.m,
    paddingTop: Spacing.l, // offset label
  }
});
