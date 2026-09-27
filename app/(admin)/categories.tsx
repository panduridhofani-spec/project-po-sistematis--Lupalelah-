import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { AppCard } from '../../src/components/AppCard';
import { AppButton } from '../../src/components/AppButton';
import { AppTextInput } from '../../src/components/AppTextInput';
import { BottomSheet } from '../../src/components/BottomSheet';
import { Typography } from '../../src/constants/Typography';
import { Spacing } from '../../src/constants/Colors';
import { useTheme } from '../../src/context/ThemeContext';
import { db } from '../../src/lib/firebase';
import { collection, doc, setDoc, getDocs, updateDoc } from 'firebase/firestore';
import { Category } from '../../src/types/master';
import { router } from 'expo-router';
import { AppAlert } from '../../src/components/AppAlert';

export default function CategoriesScreen() {
  const { colors } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryActive, setCategoryActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'categories'));
      const categoriesData: Category[] = [];
      snap.forEach(doc => {
        categoriesData.push({ id: doc.id, ...doc.data() } as Category);
      });
      categoriesData.sort((a, b) => a.name.localeCompare(b.name));
      
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error fetching categories:', error);
      AppAlert.show('Error', 'Gagal memuat daftar kategori');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryActive(true);
    setModalVisible(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryActive(category.active);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!categoryName.trim()) {
      AppAlert.show('Error', 'Nama kategori harus diisi');
      return;
    }

    setSaving(true);
    try {
      if (editingCategory) {
        await updateDoc(doc(db, 'categories', editingCategory.id), {
          name: categoryName.trim(),
          active: categoryActive
        });
      } else {
        const newId = `cat-${Date.now()}`;
        await setDoc(doc(db, 'categories', newId), {
          id: newId,
          name: categoryName.trim(),
          active: categoryActive
        });
      }

      setModalVisible(false);
      fetchCategories();
    } catch (error: any) {
      console.error('Error saving category:', error);
      if (error.code === '23505') {
        AppAlert.show('Error', 'Kategori dengan nama ini sudah ada.');
      } else {
        AppAlert.show('Error', 'Gagal menyimpan kategori');
      }
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: Category }) => (
    <AppCard style={styles.card} onPress={() => openEditModal(item)}>
      <View style={styles.cardContent}>
        <Text style={[Typography.cardTitle, { color: colors.textPrimary }]}>{item.name}</Text>
        <View style={styles.badgeContainer}>
          <View style={[
            styles.badge, 
            { backgroundColor: item.active ? colors.primaryLight : colors.border }
          ]}>
            <Text style={[
              Typography.labelSmall, 
              { color: item.active ? colors.primary : colors.textSecondary }
            ]}>
              {item.active ? 'ACTIVE' : 'INACTIVE'}
            </Text>
          </View>
        </View>
      </View>
      <Feather name="edit-2" size={20} color={colors.textSecondary} />
    </AppCard>
  );

  return (
    <ScreenContainer padding={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[Typography.screenTitle, { color: colors.textPrimary }]}>Kategori</Text>
          <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>Kelola master kategori produk</Text>
        </View>
        <TouchableOpacity 
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={openAddModal}
        >
          <Feather name="plus" size={24} color={colors.surface} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : categories.length === 0 ? (
        <View style={styles.centerContainer}>
          <Feather name="grid" size={48} color={colors.border} style={{ marginBottom: Spacing.m }} />
          <Text style={[Typography.cardTitle, { color: colors.textSecondary }]}>Belum ada kategori</Text>
          <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginTop: Spacing.xs }]}>
            Ketuk tombol + untuk menambah
          </Text>
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      <BottomSheet visible={modalVisible} onClose={() => !saving && setModalVisible(false)}>
        <Text style={[Typography.cardTitle, styles.modalTitle, { color: colors.textPrimary }]}>
          {editingCategory ? 'Edit Kategori' : 'Tambah Kategori'}
        </Text>
        
        <AppTextInput
          label="Nama Kategori"
          placeholder="Contoh: Minuman"
          value={categoryName}
          onChangeText={setCategoryName}
          editable={!saving}
        />
        
        {editingCategory && (
          <TouchableOpacity 
            style={styles.switchContainer}
            onPress={() => !saving && setCategoryActive(!categoryActive)}
          >
            <View style={[
              styles.switch, 
              { backgroundColor: categoryActive ? colors.primary : colors.border }
            ]}>
              <View style={[
                styles.switchKnob, 
                { 
                  backgroundColor: colors.surface,
                  alignSelf: categoryActive ? 'flex-end' : 'flex-start' 
                }
              ]} />
            </View>
            <Text style={[Typography.bodyMedium, { color: colors.textPrimary, marginLeft: Spacing.m }]}>
              {categoryActive ? 'Kategori Aktif' : 'Kategori Nonaktif'}
            </Text>
          </TouchableOpacity>
        )}

        <AppButton
          title={saving ? 'Menyimpan...' : 'Simpan'}
          onPress={handleSave}
          disabled={saving || !categoryName.trim()}
          style={styles.saveButton}
        />
      </BottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.l,
    paddingTop: Spacing.xl,
  },
  backButton: {
    marginRight: Spacing.m,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.l,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.m,
    padding: Spacing.m,
  },
  cardContent: {
    flex: 1,
  },
  badgeContainer: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
  },
  badge: {
    paddingHorizontal: Spacing.s,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modalTitle: {
    marginBottom: Spacing.l,
    textAlign: 'center',
  },
  saveButton: {
    marginTop: Spacing.xl,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.m,
  },
  switch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  switchKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  }
});
