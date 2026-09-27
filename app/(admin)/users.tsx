import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, FlatList, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Spacing, Radius } from '../../src/constants/Colors';
import { Typography } from '../../src/constants/Typography';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { AppCard } from '../../src/components/AppCard';
import { AppButton } from '../../src/components/AppButton';
import { AppTextInput } from '../../src/components/AppTextInput';
import { BottomSheet } from '../../src/components/BottomSheet';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { db, app as mainApp } from '../../src/lib/firebase';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getDocs, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { AppAlert } from '../../src/components/AppAlert';

interface User {
  id: string;
  email?: string;
  full_name: string;
  role: string;
  active: boolean;
  activeShift: number | null;
}

export default function UsersScreen() {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ACCOUNT' | 'EMPLOYEE'>('ACCOUNT');
  
  const [modalVisible, setModalVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('LEADER_BARISTA');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [isDirectAdd, setIsDirectAdd] = useState(false);
  const [expandedAccountIds, setExpandedAccountIds] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const accounts = users.filter(u => u.email);
  const employees = users.filter(u => !u.email);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const snap = await getDocs(collection(db, 'users'));
      const usersData: User[] = [];
      snap.forEach(d => usersData.push({ id: d.id, ...d.data() } as User));
      setUsers(usersData);
    } catch (e) {
      console.error(e);
      AppAlert.show('Error', 'Gagal memuat data pegawai.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const openAddModal = () => {
    setIsCreating(true);
    setEditingUser(null);
    setFullName('');
    setEmail('');
    setPassword('');
    setRole('LEADER_BARISTA');
    if (activeTab === 'EMPLOYEE') {
      const leaderAccounts = accounts.filter(a => a.role === 'LEADER_BARISTA');
      if (leaderAccounts.length > 0) {
        setSelectedAccountId(leaderAccounts[0].id);
      }
    }
    setIsDirectAdd(false);
    setModalVisible(true);
  };

  const openEditModal = (user: User) => {
    setIsCreating(false);
    setEditingUser(user);
    setFullName(user.full_name);
    setRole(user.role);
    // @ts-ignore - custom field for employees
    setSelectedAccountId(user.account_id || '');
    setIsDirectAdd(false);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      AppAlert.show('Error', 'Nama wajib diisi.');
      return;
    }
    
    if (isCreating && activeTab === 'ACCOUNT' && (!email.trim() || !password)) {
      AppAlert.show('Error', 'Email dan Password wajib diisi untuk akun baru.');
      return;
    }
    
    setSaving(true);
    try {
      if (isCreating) {
        if (activeTab === 'ACCOUNT') {
          // 1. Initialize secondary Firebase app
          const apps = getApps();
          const secApp = apps.find(a => a.name === 'Secondary') || initializeApp(mainApp.options, 'Secondary');
          const secAuth = getAuth(secApp);
          
          // 2. Create Auth User
          const userCred = await createUserWithEmailAndPassword(secAuth, email.trim(), password);
          const uid = userCred.user.uid;
          await secAuth.signOut(); // safety signout

          // 3. Save Account to Firestore
          await setDoc(doc(db, 'users', uid), {
            email: email.trim(),
            full_name: fullName.trim(),
            role: role,
            active: true,
            created_at: new Date().toISOString()
          });
        } else {
          // Create Employee Profile
          const newDocRef = doc(collection(db, 'users'));
          const parentAccount = accounts.find(a => a.id === selectedAccountId);
          await setDoc(newDocRef, {
            full_name: fullName.trim(),
            role: parentAccount?.role || 'LEADER_BARISTA', // inherit role from account
            account_id: selectedAccountId,
            active: true,
            created_at: new Date().toISOString()
          });
        }
      } else if (editingUser) {
        if (activeTab === 'ACCOUNT') {
          await updateDoc(doc(db, 'users', editingUser.id), {
            full_name: fullName.trim(),
            role: role
          });
        } else {
          const parentAccount = accounts.find(a => a.id === selectedAccountId);
          await updateDoc(doc(db, 'users', editingUser.id), {
            full_name: fullName.trim(),
            account_id: selectedAccountId,
            role: parentAccount?.role || 'LEADER_BARISTA'
          });
        }
      }
      
      setModalVisible(false);
      fetchUsers();
    } catch (e: any) {
      console.error(e);
      AppAlert.show('Error', 'Gagal menyimpan data pegawai.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editingUser) return;
    
    if (editingUser.id === profile?.id) {
      AppAlert.show('Akses Ditolak', 'Anda tidak dapat menghapus akun Anda sendiri.');
      return;
    }
    
    if ((editingUser.role === 'ADMIN' || editingUser.role === 'MASTER_ADMIN') && activeTab === 'ACCOUNT') {
      AppAlert.show('Akses Ditolak', 'Akun dengan role Admin/Manager tidak dapat dihapus.');
      return;
    }

    AppAlert.show(
      'Hapus Pegawai',
      `Yakin ingin menghapus ${editingUser.full_name}? Aksi ini akan menghapus data profil (Login akan gagal).`,
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Hapus', style: 'destructive', onPress: async () => {
          setSaving(true);
          try {
            await deleteDoc(doc(db, 'users', editingUser.id));
            setModalVisible(false);
            fetchUsers();
          } catch (e) {
            AppAlert.show('Error', 'Gagal menghapus pegawai.');
          } finally {
            setSaving(false);
          }
        }}
      ]
    );
  };

  const renderItem = ({ item }: { item: User }) => (
    <AppCard style={styles.card} onPress={() => openEditModal(item)}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: item.role === 'LOGISTICS' ? colors.primary + '20' : colors.safe + '20' }]}>
          <Feather name={item.role === 'LOGISTICS' ? "truck" : "user"} size={24} color={item.role === 'LOGISTICS' ? colors.primary : colors.safe} />
        </View>
        <View style={styles.info}>
          <Text style={[Typography.cardTitle, { color: colors.textPrimary }]}>{item.full_name}</Text>
          {item.email && (
            <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>{item.email}</Text>
          )}
        </View>
        <View style={[styles.roleBadge, { backgroundColor: item.role === 'LOGISTICS' ? colors.primary : item.role === 'ADMIN' ? colors.outOfStock : colors.safe }]}>
          <Text style={styles.roleText}>{item.role}</Text>
        </View>
      </View>
    </AppCard>
  );

  const renderAccountWithEmployees = ({ item: account }: { item: User }) => {
    // @ts-ignore
    const accEmployees = employees.filter(e => e.account_id === account.id);
    const isExpanded = expandedAccountIds[account.id];
    
    return (
      <AppCard style={styles.card} onPress={() => {
        setExpandedAccountIds(prev => ({...prev, [account.id]: !prev[account.id]}))
      }}>
        <View style={styles.row}>
          <View style={[styles.avatar, { backgroundColor: colors.safe + '20' }]}>
            <Feather name="coffee" size={24} color={colors.safe} />
          </View>
          <View style={styles.info}>
            <Text style={[Typography.cardTitle, { color: colors.textPrimary }]}>{account.full_name}</Text>
            <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>{account.email}</Text>
          </View>
          <TouchableOpacity 
             onPress={() => {
                setIsCreating(true);
                setEditingUser(null);
                setFullName('');
                setSelectedAccountId(account.id);
                setIsDirectAdd(true);
                setModalVisible(true);
             }}
             style={{ paddingHorizontal: Spacing.s, paddingVertical: 6, backgroundColor: colors.primary + '20', borderRadius: Radius.small, marginRight: Spacing.s }}
          >
            <Text style={[Typography.labelSmall, { color: colors.primary }]}>+ Pegawai</Text>
          </TouchableOpacity>
          <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
        </View>
        
        {isExpanded && (
          <View style={{ marginTop: Spacing.m, paddingTop: Spacing.m, borderTopWidth: 1, borderColor: colors.border }}>
            {accEmployees.length === 0 ? (
              <Text style={[Typography.bodySmall, { color: colors.textSecondary, fontStyle: 'italic', textAlign: 'center' }]}>
                Belum ada pegawai
              </Text>
            ) : (
              accEmployees.map(emp => (
                <TouchableOpacity 
                  key={emp.id} 
                  style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.s, borderBottomWidth: 1, borderColor: colors.border }}
                  onPress={() => openEditModal(emp)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textSecondary, marginRight: Spacing.s }} />
                    <Text style={[Typography.bodyMedium, { color: colors.textPrimary }]}>{emp.full_name}</Text>
                  </View>
                  <Feather name="edit-2" size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </AppCard>
    );
  };

  return (
    <ScreenContainer padding={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[Typography.screenTitle, { color: colors.textPrimary }]}>Pegawai</Text>
          <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>Atur Hak Akses Akun</Text>
        </View>
        <TouchableOpacity 
          onPress={openAddModal} 
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: Spacing.m,
            paddingVertical: Spacing.s,
            borderRadius: Radius.medium,
            flexDirection: 'row',
            alignItems: 'center'
          }}
        >
          <Feather name="plus" size={16} color="#FFF" style={{ marginRight: 4 }} />
          <Text style={[Typography.labelSmall, { color: '#FFF' }]}>{activeTab === 'ACCOUNT' ? 'Akun' : 'Pegawai'}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: Spacing.l, marginBottom: Spacing.m }}>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 10, borderBottomWidth: 2, borderColor: activeTab === 'ACCOUNT' ? colors.primary : 'transparent', alignItems: 'center' }}
          onPress={() => setActiveTab('ACCOUNT')}
        >
          <Text style={[Typography.labelLarge, { color: activeTab === 'ACCOUNT' ? colors.primary : colors.textSecondary }]}>Daftar Akun Outlet</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 10, borderBottomWidth: 2, borderColor: activeTab === 'EMPLOYEE' ? colors.primary : 'transparent', alignItems: 'center' }}
          onPress={() => setActiveTab('EMPLOYEE')}
        >
          <Text style={[Typography.labelLarge, { color: activeTab === 'EMPLOYEE' ? colors.primary : colors.textSecondary }]}>Daftar Pegawai</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: Spacing.l, paddingBottom: Spacing.m }}>
        <AppTextInput
          placeholder="Cari nama atau jabatan..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: Spacing.xxl }} />
      ) : (
        <FlatList
          data={activeTab === 'ACCOUNT' 
            ? accounts.filter(u => u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || u.role.toLowerCase().includes(searchQuery.toLowerCase()))
            : accounts.filter(a => a.role === 'LEADER_BARISTA' && (a.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || (a.email && a.email.toLowerCase().includes(searchQuery.toLowerCase()))))
          }
          keyExtractor={item => item.id}
          renderItem={activeTab === 'ACCOUNT' ? renderItem : renderAccountWithEmployees}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={() => fetchUsers(true)} 
              colors={[colors.primary]} 
            />
          }
        />
      )}

      <BottomSheet visible={modalVisible} onClose={() => !saving && setModalVisible(false)}>
        <Text style={[Typography.cardTitle, { color: colors.textPrimary, marginBottom: Spacing.m, textAlign: 'center' }]}>
          {isCreating ? (activeTab === 'ACCOUNT' ? 'Tambah Akun Outlet/Login' : 'Tambah Pegawai') : (activeTab === 'ACCOUNT' ? 'Edit Akun' : 'Edit Pegawai')}
        </Text>
        
        {isCreating && activeTab === 'ACCOUNT' && (
          <>
            <AppTextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!saving}
            />
            <View style={{ height: Spacing.m }} />
            <AppTextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!saving}
            />
            <View style={{ height: Spacing.m }} />
          </>
        )}

        {activeTab === 'EMPLOYEE' && !isDirectAdd && (
          <>
            <Text style={[Typography.labelSmall, { color: colors.textSecondary, marginBottom: Spacing.xs }]}>
              Pilih Akun Outlet/Login
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.s, marginBottom: Spacing.m }}>
              {accounts.filter(a => a.role === 'LEADER_BARISTA').map(acc => (
                <TouchableOpacity
                  key={acc.id}
                  style={{
                    padding: Spacing.s, borderRadius: Radius.small, borderWidth: 1,
                    borderColor: selectedAccountId === acc.id ? colors.primary : colors.border,
                    backgroundColor: selectedAccountId === acc.id ? colors.primary : colors.surface
                  }}
                  onPress={() => setSelectedAccountId(acc.id)}
                >
                  <Text style={[Typography.bodySmall, { color: selectedAccountId === acc.id ? colors.surface : colors.textPrimary }]}>
                    {acc.email}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <AppTextInput
          label={activeTab === 'ACCOUNT' ? "Nama Outlet / Akun" : "Nama Pegawai"}
          value={fullName}
          onChangeText={setFullName}
          editable={!saving}
        />

        {activeTab === 'ACCOUNT' && (
          <>
            <Text style={[Typography.labelSmall, { color: colors.textSecondary, marginTop: Spacing.m, marginBottom: Spacing.xs }]}>
              Role (Jabatan)
            </Text>
            {editingUser?.role === 'MASTER_ADMIN' ? (
              <View style={{ padding: Spacing.s, borderRadius: Radius.small, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: Spacing.m }}>
                <Text style={[Typography.labelSmall, { color: colors.textSecondary, textAlign: 'center' }]}>Master Admin (Paten)</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: Spacing.s, marginBottom: Spacing.m }}>
                {['LEADER_BARISTA', 'LOGISTICS', 'ADMIN'].map(r => (
                  <TouchableOpacity 
                    key={r}
                    style={{
                      flex: 1, padding: Spacing.s, borderRadius: Radius.small, borderWidth: 1,
                      borderColor: role === r ? colors.primary : colors.border,
                      backgroundColor: role === r ? colors.primary : colors.surface
                    }}
                    onPress={() => setRole(r)}
                  >
                    <Text style={[Typography.labelSmall, { color: role === r ? colors.surface : colors.textPrimary, textAlign: 'center' }]}>
                      {r === 'LEADER_BARISTA' ? 'Barista' : r === 'LOGISTICS' ? 'Logistik' : 'Admin'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        <AppButton
          title={saving ? 'Menyimpan...' : 'Simpan'}
          onPress={handleSave}
          disabled={saving || !fullName.trim()}
          style={{ marginTop: Spacing.xl }}
        />

        {!isCreating && editingUser?.id !== profile?.id && editingUser?.role !== 'MASTER_ADMIN' && editingUser?.role !== 'ADMIN' && (
          <TouchableOpacity 
            onPress={handleDelete}
            style={{ padding: Spacing.m, marginTop: Spacing.s, alignItems: 'center' }}
            disabled={saving}
          >
            <Text style={[Typography.labelLarge, { color: colors.outOfStock }]}>Hapus Pegawai</Text>
          </TouchableOpacity>
        )}
      </BottomSheet>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.m,
  },
  info: {
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: Spacing.s,
    paddingVertical: 4,
    borderRadius: Radius.small,
  },
  roleText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  infoBox: {
    flexDirection: 'row',
    padding: Spacing.m,
    borderWidth: 1,
    borderRadius: Radius.medium,
    alignItems: 'center',
  }
});
