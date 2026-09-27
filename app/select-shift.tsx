import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { AppCard } from '../src/components/AppCard';
import { AppButton } from '../src/components/AppButton';
import { Typography } from '../src/constants/Typography';
import { Spacing, Radius } from '../src/constants/Colors';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ShiftSchedule } from '../src/types/shift';
import { UserProfile } from '../src/types/auth';
import { AppAlert } from '../src/components/AppAlert';
import { getOperationalDate } from '../src/utils/date';

export default function SelectShiftScreen() {
  const { colors } = useTheme();
  const { setActiveShift, setActiveLeader, signOut, profile } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<ShiftSchedule[]>([]);
  const [leaders, setLeaders] = useState<UserProfile[]>([]);
  const [selectedShift, setSelectedShift] = useState<ShiftSchedule | null>(null);
  const [selectedLeader, setSelectedLeader] = useState<UserProfile | null>(null);
  const [isLeaderDropdownOpen, setIsLeaderDropdownOpen] = useState(false);
  const [leaderSearch, setLeaderSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [opDate, setOpDate] = useState(getOperationalDate());



  useEffect(() => {
    if (profile) {
      fetchData();
    }
  }, [profile]);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const q = query(collection(db, 'shift_schedules'), where('active', '==', true));
      const snap = await getDocs(q);
      
      const shiftsData: ShiftSchedule[] = [];
      snap.forEach(doc => {
        shiftsData.push({ id: doc.id, ...doc.data() } as unknown as ShiftSchedule);
      });
      shiftsData.sort((a, b) => a.shift_number - b.shift_number);

      if (shiftsData.length === 0) {
        throw new Error('Belum ada jadwal shift yang dikonfigurasi.');
      }

      setShifts(shiftsData);
      if (shiftsData.length > 0) {
        setSelectedShift(shiftsData[0]);
      }

      if (!profile?.id) {
        throw new Error('Profil Akun Outlet tidak ditemukan.');
      }

      const lq = query(
        collection(db, 'users'), 
        where('account_id', '==', profile.id),
        where('active', '==', true)
      );
      const lSnap = await getDocs(lq);
      const lData: UserProfile[] = [];
      lSnap.forEach(d => {
        lData.push({ id: d.id, ...d.data() } as UserProfile);
      });
      setLeaders(lData);
      if (lData.length > 0) {
        setSelectedLeader(lData[0]);
      }
    } catch (e: any) {
      console.error('Error fetching data:', e);
      setErrorMsg(e.message || 'Gagal memuat jadwal shift atau daftar leader.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartWork = async () => {
    if (selectedShift && selectedLeader) {
      try {
        const opDate = getOperationalDate();

        // 1. Check if the selected shift is ALREADY completed today
        const currentStockSnap = await getDocs(query(
          collection(db, 'stock_takings'),
          where('operational_date', '==', opDate),
          where('shift_number', '==', selectedShift.shift_number)
        ));
        
        let shiftAlreadyCompletedBy = null;
        if (!currentStockSnap.empty) {
          const data = currentStockSnap.docs[0].data();
          shiftAlreadyCompletedBy = data.taken_by_name || 'Leader Lain';
        }

        // 2. Check ongoing (in-progress) shift in AsyncStorage
        const ongoingShiftStr = await AsyncStorage.getItem('ongoingShift');
        const ongoingLeaderStr = await AsyncStorage.getItem('ongoingLeader');
        
        if (ongoingShiftStr && ongoingLeaderStr) {
          const ongoingShift = parseInt(ongoingShiftStr, 10);
          const ongoingLeader = JSON.parse(ongoingLeaderStr) as UserProfile;
          
          if (ongoingShift !== selectedShift.shift_number) {
            AppAlert.show(
              'Peringatan', 
              `Tolong selesaikan Shift ${ongoingShift} dengan nama ${ongoingLeader.full_name} terlebih dahulu.`
            );
            return;
          }
          
          if (ongoingLeader.id !== selectedLeader.id) {
            AppAlert.show(
              'Peringatan', 
              `Pada shift ${ongoingShift} yang belum selesai namanya ${ongoingLeader.full_name}. Silakan masuk dengan nama tersebut.`
            );
            return;
          }
        }

        // 3. If it's already completed and no ongoing restriction blocked it
        if (shiftAlreadyCompletedBy) {
          AppAlert.show(
            'Shift Selesai', 
            `Shift ${selectedShift.shift_number} sebelumnya sudah selesai dilakukan oleh ${shiftAlreadyCompletedBy}. Anda tetap bisa masuk untuk melihat data.`,
            [
              { text: 'Batal', style: 'cancel' },
              { 
                text: 'Masuk', 
                onPress: async () => {
                  await setActiveShift(selectedShift.shift_number);
                  await setActiveLeader(selectedLeader);
                  router.replace('/(barista)');
                }
              }
            ]
          );
          return; // Stop execution here, wait for user to press 'Masuk'
        }
      } catch (e) {
        console.error('Error checking ongoing shift:', e);
      }

      AppAlert.show(
        'Konfirmasi Masuk',
        `Apakah Anda yakin ingin mulai bekerja di Shift ${selectedShift.shift_number} sebagai ${selectedLeader.full_name}?`,
        [
          { text: 'Batal', style: 'cancel' },
          { 
            text: 'Ya, Mulai', 
            onPress: async () => {
              await setActiveShift(selectedShift.shift_number);
              await setActiveLeader(selectedLeader);
              router.replace('/(barista)');
            }
          }
        ]
      );
    }
  };

  return (
    <ScreenContainer padding={false}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppCard style={styles.card}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginTop: Spacing.m }]}>
                Memuat Jadwal Shift...
              </Text>
            </View>
          ) : errorMsg ? (
            <View style={styles.centerContainer}>
              <Feather name="alert-circle" size={48} color={colors.outOfStock} style={{ marginBottom: Spacing.m }} />
              <Text style={[Typography.cardTitle, { color: colors.textPrimary, textAlign: 'center', marginBottom: Spacing.s }]}>
                Tidak Bisa Memulai Shift
              </Text>
              <Text style={[Typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl }]}>
                {errorMsg}
              </Text>
              <AppButton title="Coba Lagi" onPress={fetchData} style={{ width: '100%', marginBottom: Spacing.m }} />
              <AppButton 
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
                variant="secondary" 
                style={{ width: '100%' }} 
              />
            </View>
          ) : (
            <View>
              <View style={styles.headerContainer}>
                <Feather name="clock" size={40} color={colors.primary} style={{ marginBottom: Spacing.m }} />
                <Text style={[Typography.screenTitle, { color: colors.textPrimary, textAlign: 'center', marginBottom: Spacing.xs }]}>
                  Pilih Shift
                </Text>
                <Text style={[Typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center', marginBottom: Spacing.s }]}>
                  Silakan pilih shift Anda untuk mulai bekerja.
                </Text>
                <Text style={[Typography.labelLarge, { color: colors.primary, textAlign: 'center', marginBottom: Spacing.m, fontWeight: 'bold' }]}>
                  Tanggal: {opDate}
                </Text>

              </View>

              <ScrollView 
                style={styles.shiftList} 
                contentContainerStyle={styles.shiftGrid}
                showsVerticalScrollIndicator={false}
              >
                {shifts.map((shift) => {
                  const isSelected = selectedShift?.shift_number === shift.shift_number;
                  return (
                    <TouchableOpacity
                      key={shift.shift_number}
                      style={[
                        styles.shiftOption,
                        { 
                          borderColor: isSelected ? colors.primary : colors.border,
                          backgroundColor: isSelected ? colors.primaryLight : colors.surface,
                          borderWidth: isSelected ? 2 : 1
                        }
                      ]}
                      onPress={() => setSelectedShift(shift)}
                    >
                      <View style={styles.shiftOptionHeader}>
                        <Text style={[Typography.cardTitle, { color: isSelected ? colors.primary : colors.textPrimary }]}>
                          Shift {shift.shift_number}
                        </Text>
                        {isSelected && (
                          <Feather name="check-circle" size={16} color={colors.primary} />
                        )}
                      </View>
                      <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
                        {shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[Typography.cardTitle, { color: colors.textPrimary, marginBottom: Spacing.xs, marginTop: Spacing.m }]}>
                Pilih Nama Leader
              </Text>
              
              <TouchableOpacity 
                style={[styles.dropdownHeader, { borderColor: isLeaderDropdownOpen ? colors.primary : colors.border, backgroundColor: colors.surface }]}
                onPress={() => setIsLeaderDropdownOpen(!isLeaderDropdownOpen)}
              >
                <Text style={[Typography.bodyMedium, { color: selectedLeader ? colors.textPrimary : colors.textSecondary }]}>
                  {selectedLeader ? selectedLeader.full_name : 'Pilih Nama Leader'}
                </Text>
                <Feather name={isLeaderDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              {isLeaderDropdownOpen && (
                <View style={[styles.leaderListContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <View style={[styles.searchContainer, { borderBottomColor: colors.border }]}>
                    <Feather name="search" size={16} color={colors.textSecondary} style={{ marginRight: Spacing.xs }} />
                    <TextInput
                      style={[styles.searchInput, { color: colors.textPrimary }]}
                      placeholder="Cari nama leader..."
                      placeholderTextColor={colors.textSecondary}
                      value={leaderSearch}
                      onChangeText={setLeaderSearch}
                    />
                  </View>
                  <ScrollView 
                    style={styles.leaderList} 
                    showsVerticalScrollIndicator={true}
                    persistentScrollbar={true}
                  >
                    {leaders.filter(l => l.full_name.toLowerCase().includes(leaderSearch.toLowerCase())).map((leader, index, filteredArray) => {
                      const isSelected = selectedLeader?.id === leader.id;
                      const isLast = index === filteredArray.length - 1;
                      return (
                        <TouchableOpacity
                          key={leader.id}
                          style={[
                            styles.leaderOption,
                            { 
                              borderBottomColor: isLast ? 'transparent' : colors.border,
                              backgroundColor: isSelected ? colors.primaryLight : 'transparent',
                            }
                          ]}
                          onPress={() => {
                            setSelectedLeader(leader);
                            setIsLeaderDropdownOpen(false);
                            setLeaderSearch('');
                          }}
                        >
                          <Text style={[Typography.bodyMedium, { color: isSelected ? colors.primary : colors.textPrimary, flex: 1, fontWeight: isSelected ? 'bold' : 'normal' }]} numberOfLines={1}>
                            {leader.full_name}
                          </Text>
                          {isSelected && (
                            <Feather name="check" size={18} color={colors.primary} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                    {leaders.filter(l => l.full_name.toLowerCase().includes(leaderSearch.toLowerCase())).length === 0 && (
                      <View style={{ padding: Spacing.m }}>
                        <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>Leader tidak ditemukan.</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              )}

              <AppButton 
                title="Mulai Bekerja" 
                onPress={handleStartWork} 
                disabled={!selectedShift || !selectedLeader}
                style={{ width: '100%', marginTop: Spacing.l }} 
              />
              <AppButton 
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
                variant="secondary" 
                style={{ width: '100%', marginTop: Spacing.m }} 
              />
            </View>
          )}
        </AppCard>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    padding: Spacing.xl,
    borderRadius: Radius.large,
    maxHeight: '90%',
  },
  centerContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  headerContainer: {
    alignItems: 'center',
  },
  shiftList: {
    maxHeight: 280, // Limit height so it scrolls if there are many shifts
  },
  shiftGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  shiftOption: {
    width: '48%', // two columns
    padding: Spacing.m,
    borderRadius: Radius.medium,
    marginBottom: Spacing.m,
  },
  shiftOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  leaderListContainer: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },
  leaderList: {
    maxHeight: 160,
  },
  leaderOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.m,
    borderBottomWidth: 1,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.m,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.m,
    paddingVertical: Spacing.s,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    padding: 0,
    fontSize: 14,
  }
});
