import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { AppCard } from '../../src/components/AppCard';
import { AppButton } from '../../src/components/AppButton';
import { AppTextInput } from '../../src/components/AppTextInput';
import { BottomSheet } from '../../src/components/BottomSheet';
import { Typography } from '../../src/constants/Typography';
import { Spacing, Radius } from '../../src/constants/Colors';
import { useTheme } from '../../src/context/ThemeContext';
import { db } from '../../src/lib/firebase';
import { collection, doc, setDoc, getDocs, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { ProductWithCategory, Category, Unit } from '../../src/types/master';
import { AppAlert } from '../../src/components/AppAlert';
import { FilterChip } from '../../src/components/FilterChip';

export default function ProductsScreen() {
  const { colors } = useTheme();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  
  const [activeTab, setActiveTab] = useState<'KATEGORI' | 'PRODUK' | 'SATUAN'>('KATEGORI');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithCategory | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  
  // Form State Product
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [unit, setUnit] = useState('');
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [safetyStock, setSafetyStock] = useState('0');
  const [active, setActive] = useState(true);
  
  // Form State Category
  const [categoryName, setCategoryName] = useState('');
  const [categoryActive, setCategoryActive] = useState(true);

  // Form State Unit
  const [unitName, setUnitName] = useState('');
  const [unitActive, setUnitActive] = useState(true);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodSnap, catSnap, unitSnap] = await Promise.all([
        getDocs(collection(db, 'products')),
        getDocs(query(collection(db, 'categories'), where('active', '==', true))),
        getDocs(query(collection(db, 'units'), where('active', '==', true)))
      ]);

      const categoriesData: Category[] = [];
      const catMap: Record<string, Category> = {};
      catSnap.forEach(d => {
        const cat = { id: d.id, ...d.data() } as Category;
        categoriesData.push(cat);
        catMap[d.id] = cat;
      });
      categoriesData.sort((a, b) => a.name.localeCompare(b.name));

      const productsData: ProductWithCategory[] = [];
      prodSnap.forEach(d => {
        const pData = d.data();
        productsData.push({
          id: d.id,
          ...pData,
          categories: catMap[pData.category_id]
        } as unknown as ProductWithCategory);
      });
      productsData.sort((a, b) => a.name.localeCompare(b.name));

      const unitsData: Unit[] = [];
      unitSnap.forEach(d => {
        unitsData.push({ id: d.id, ...d.data() } as Unit);
      });
      unitsData.sort((a, b) => a.name.localeCompare(b.name));

      setProducts(productsData);
      setCategories(categoriesData);
      setUnits(unitsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      AppAlert.show('Error', 'Gagal memuat data produk');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = categoryFilter === 'All' || p.category_id === categoryFilter;
    return matchSearch && matchCat;
  });
  
  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUnits = units.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openAddModal = () => {
    if (activeTab === 'PRODUK') {
      setEditingProduct(null);
      setName('');
      setCategoryId(categories.length > 0 ? categories[0].id : '');
      setUnit(units.length > 0 ? units[0].name : '');
      setSafetyStock('0');
      setActive(true);
    } else if (activeTab === 'KATEGORI') {
      setEditingCategory(null);
      setCategoryName('');
      setCategoryActive(true);
    } else {
      setEditingUnit(null);
      setUnitName('');
      setUnitActive(true);
    }
    setModalVisible(true);
  };

  const openEditModal = (product: ProductWithCategory) => {
    setEditingProduct(product);
    setName(product.name);
    setCategoryId(product.category_id);
    setUnit(product.unit);
    setSafetyStock(product.safety_stock.toString());
    setActive(product.active);
    setModalVisible(true);
  };

  const openCategoryEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryActive(cat.active);
    setModalVisible(true);
  };

  const openUnitEditModal = (u: Unit) => {
    setEditingUnit(u);
    setUnitName(u.name);
    setUnitActive(u.active);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (activeTab === 'PRODUK') {
      if (!name.trim() || !categoryId || !unit.trim()) {
        AppAlert.show('Error', 'Nama, kategori, dan unit wajib diisi');
        return;
      }
      
      const parsedStock = parseFloat(safetyStock.replace(',', '.'));
      if (isNaN(parsedStock) || parsedStock < 0) {
        AppAlert.show('Error', 'Safety stock harus berupa angka >= 0');
        return;
      }

      setSaving(true);
      try {
        const payload = {
          name: name.trim(),
          category_id: categoryId,
          unit: unit.trim(),
          safety_stock: parsedStock,
          active,
        };

        if (editingProduct) {
          await updateDoc(doc(db, 'products', editingProduct.id), payload);
        } else {
          const newId = `prod-${Date.now()}`;
          await setDoc(doc(db, 'products', newId), { id: newId, ...payload });
        }

        setModalVisible(false);
        fetchData(); // Refresh data
      } catch (error: any) {
        console.error('Error saving product:', error);
        AppAlert.show('Error', 'Gagal menyimpan produk');
      } finally {
        setSaving(false);
      }
    } else if (activeTab === 'KATEGORI') {
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
        fetchData(); // Refresh data
      } catch (error: any) {
        console.error('Error saving category:', error);
        AppAlert.show('Error', 'Gagal menyimpan kategori');
      } finally {
        setSaving(false);
      }
    } else {
      if (!unitName.trim()) {
        AppAlert.show('Error', 'Nama satuan harus diisi');
        return;
      }

      setSaving(true);
      try {
        if (editingUnit) {
          await updateDoc(doc(db, 'units', editingUnit.id), {
            name: unitName.trim(),
            active: unitActive
          });
        } else {
          const newId = `unit-${Date.now()}`;
          await setDoc(doc(db, 'units', newId), {
            id: newId,
            name: unitName.trim(),
            active: unitActive
          });
        }

        setModalVisible(false);
        fetchData(); // Refresh data
      } catch (error: any) {
        console.error('Error saving unit:', error);
        AppAlert.show('Error', 'Gagal menyimpan satuan');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDelete = () => {
    let targetName = '';
    
    if (activeTab === 'PRODUK' && editingProduct) targetName = editingProduct.name;
    else if (activeTab === 'KATEGORI' && editingCategory) targetName = editingCategory.name;
    else if (activeTab === 'SATUAN' && editingUnit) targetName = editingUnit.name;

    if (!targetName) return;

    AppAlert.show(
      'Hapus Data',
      `Apakah Anda yakin ingin menghapus "${targetName}"? Data yang sudah dihapus tidak dapat dikembalikan.`,
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Hapus', 
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              if (activeTab === 'PRODUK' && editingProduct) {
                await deleteDoc(doc(db, 'products', editingProduct.id));
              } else if (activeTab === 'KATEGORI' && editingCategory) {
                await deleteDoc(doc(db, 'categories', editingCategory.id));
              } else if (activeTab === 'SATUAN' && editingUnit) {
                await deleteDoc(doc(db, 'units', editingUnit.id));
              }
              setModalVisible(false);
              fetchData();
              AppAlert.show('Sukses', 'Data berhasil dihapus');
            } catch (error: any) {
              console.error('Error deleting data:', error);
              AppAlert.show('Error', 'Gagal menghapus data');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };
    
  // The function logic is replaced in the chunk above, so just clearing this part


  const renderProductItem = ({ item }: { item: ProductWithCategory }) => (
    <AppCard style={[styles.card, !item.active && { opacity: 0.6 }]} onPress={() => openEditModal(item)}>
      <View style={styles.cardIcon}>
        <Feather name="box" size={24} color={item.active ? colors.primary : colors.textSecondary} />
      </View>
      <View style={styles.cardContent}>
        <Text style={[Typography.cardTitle, { color: colors.textPrimary }]}>{item.name}</Text>
        <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginTop: 2 }]}>
          {item.categories?.name || 'Kategori tidak valid'} • Satuan: {item.unit}
        </Text>
        
        <View style={styles.tagsContainer}>
          <View style={[styles.tag, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
            <Text style={[Typography.labelSmall, { color: colors.textSecondary }]}>
              Safety Stock: {item.safety_stock}
            </Text>
          </View>
          
          <View style={[
            styles.tag, 
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

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <AppCard style={[styles.card, !item.active && { opacity: 0.6 }]} onPress={() => openCategoryEditModal(item)}>
      <View style={styles.cardIcon}>
        <Feather name="grid" size={24} color={item.active ? colors.primary : colors.textSecondary} />
      </View>
      <View style={styles.cardContent}>
        <Text style={[Typography.cardTitle, { color: colors.textPrimary }]}>{item.name}</Text>
        <View style={styles.tagsContainer}>
          <View style={[
            styles.tag, 
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

  const renderUnitItem = ({ item }: { item: Unit }) => (
    <AppCard style={[styles.card, !item.active && { opacity: 0.6 }]} onPress={() => openUnitEditModal(item)}>
      <View style={styles.cardIcon}>
        <Feather name="layers" size={24} color={item.active ? colors.primary : colors.textSecondary} />
      </View>
      <View style={styles.cardContent}>
        <Text style={[Typography.cardTitle, { color: colors.textPrimary }]}>{item.name}</Text>
        <View style={styles.tagsContainer}>
          <View style={[
            styles.tag, 
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
          <Text style={[Typography.screenTitle, { color: colors.textPrimary }]}>Daftar Produk</Text>
          <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>Kelola Stok & Master Data</Text>
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
          <Text style={[Typography.labelSmall, { color: '#FFF' }]}>
            {activeTab === 'PRODUK' ? 'Produk' : activeTab === 'KATEGORI' ? 'Kategori' : 'Satuan'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: Spacing.l, marginBottom: Spacing.m }}>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 10, borderBottomWidth: 2, borderColor: activeTab === 'KATEGORI' ? colors.primary : 'transparent', alignItems: 'center' }}
          onPress={() => setActiveTab('KATEGORI')}
        >
          <Text style={[Typography.labelLarge, { color: activeTab === 'KATEGORI' ? colors.primary : colors.textSecondary }]}>Kategori</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 10, borderBottomWidth: 2, borderColor: activeTab === 'SATUAN' ? colors.primary : 'transparent', alignItems: 'center' }}
          onPress={() => setActiveTab('SATUAN')}
        >
          <Text style={[Typography.labelLarge, { color: activeTab === 'SATUAN' ? colors.primary : colors.textSecondary }]}>Satuan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 10, borderBottomWidth: 2, borderColor: activeTab === 'PRODUK' ? colors.primary : 'transparent', alignItems: 'center' }}
          onPress={() => setActiveTab('PRODUK')}
        >
          <Text style={[Typography.labelLarge, { color: activeTab === 'PRODUK' ? colors.primary : colors.textSecondary }]}>Produk</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <AppTextInput
          placeholder={activeTab === 'PRODUK' ? "Cari produk..." : activeTab === 'KATEGORI' ? "Cari kategori..." : "Cari satuan..."}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        
        {activeTab === 'PRODUK' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: Spacing.m }}>
            <FilterChip 
              label="All"
              active={categoryFilter === 'All'}
              onPress={() => setCategoryFilter('All')}
            />
            {categories.map(cat => (
              <FilterChip 
                key={cat.id}
                label={cat.name}
                active={categoryFilter === cat.id}
                onPress={() => setCategoryFilter(cat.id)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : activeTab === 'PRODUK' ? (
        filteredProducts.length === 0 ? (
          <View style={styles.centerContainer}>
            <Feather name="box" size={48} color={colors.border} style={{ marginBottom: Spacing.m }} />
            <Text style={[Typography.cardTitle, { color: colors.textSecondary }]}>Tidak ada produk</Text>
            <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginTop: Spacing.xs }]}>
              {searchQuery ? 'Coba ubah kata kunci pencarian' : 'Ketuk tombol + untuk menambah'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            renderItem={renderProductItem}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        )
      ) : activeTab === 'KATEGORI' ? (
        filteredCategories.length === 0 ? (
          <View style={styles.centerContainer}>
            <Feather name="grid" size={48} color={colors.border} style={{ marginBottom: Spacing.m }} />
            <Text style={[Typography.cardTitle, { color: colors.textSecondary }]}>Belum ada kategori</Text>
            <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginTop: Spacing.xs }]}>
              {searchQuery ? 'Coba ubah kata kunci pencarian' : 'Ketuk tombol + untuk menambah'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredCategories}
            keyExtractor={(item) => item.id}
            renderItem={renderCategoryItem}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        )
      ) : (
        filteredUnits.length === 0 ? (
          <View style={styles.centerContainer}>
            <Feather name="layers" size={48} color={colors.border} style={{ marginBottom: Spacing.m }} />
            <Text style={[Typography.cardTitle, { color: colors.textSecondary }]}>Belum ada satuan</Text>
            <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginTop: Spacing.xs }]}>
              {searchQuery ? 'Coba ubah kata kunci pencarian' : 'Ketuk tombol + untuk menambah'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredUnits}
            keyExtractor={(item) => item.id}
            renderItem={renderUnitItem}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        )
      )}

      <BottomSheet visible={modalVisible} onClose={() => !saving && setModalVisible(false)}>
        <Text style={[Typography.cardTitle, styles.modalTitle, { color: colors.textPrimary }]}>
          {activeTab === 'PRODUK' 
            ? (editingProduct ? 'Edit Produk' : 'Tambah Produk')
            : activeTab === 'KATEGORI' ? (editingCategory ? 'Edit Kategori' : 'Tambah Kategori')
            : (editingUnit ? 'Edit Satuan' : 'Tambah Satuan')}
        </Text>
        
        {activeTab === 'PRODUK' ? (
          <>
            <AppTextInput
              label="Nama Produk"
              placeholder="Contoh: Susu UHT"
              value={name}
              onChangeText={setName}
              editable={!saving}
            />

            <View style={{ zIndex: 3 }}>
              <Text style={[Typography.labelSmall, { color: colors.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.m }]}>
                Kategori
              </Text>
              <TouchableOpacity 
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: Radius.medium,
                  padding: Spacing.m,
                  backgroundColor: colors.surface
                }}
                onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
              >
                <Text style={[Typography.bodyMedium, { color: categoryId ? colors.textPrimary : colors.textSecondary }]}>
                  {categoryId ? categories.find(c => c.id === categoryId)?.name || 'Pilih Kategori' : 'Pilih Kategori'}
                </Text>
                <Feather name={showCategoryDropdown ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              {showCategoryDropdown && (
                <View style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: Radius.medium,
                  marginTop: Spacing.xs,
                  backgroundColor: colors.surface,
                  maxHeight: 150,
                  overflow: 'hidden'
                }}>
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {categories.map((cat, index) => (
                      <TouchableOpacity
                        key={cat.id}
                        style={{
                          padding: Spacing.m,
                          borderBottomWidth: index === categories.length - 1 ? 0 : 1,
                          borderBottomColor: colors.border,
                          backgroundColor: categoryId === cat.id ? colors.primary + '10' : 'transparent'
                        }}
                        onPress={() => {
                          setCategoryId(cat.id);
                          setShowCategoryDropdown(false);
                        }}
                      >
                        <Text style={[Typography.bodyMedium, { color: categoryId === cat.id ? colors.primary : colors.textPrimary }]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={{ zIndex: 2 }}>
              <Text style={[Typography.labelSmall, { color: colors.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.m }]}>
                Unit / Satuan
              </Text>
              <TouchableOpacity 
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: Radius.medium,
                  padding: Spacing.m,
                  backgroundColor: colors.surface
                }}
                onPress={() => setShowUnitDropdown(!showUnitDropdown)}
              >
                <Text style={[Typography.bodyMedium, { color: unit ? colors.textPrimary : colors.textSecondary }]}>
                  {unit || 'Pilih Satuan'}
                </Text>
                <Feather name={showUnitDropdown ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              {showUnitDropdown && (
                <View style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: Radius.medium,
                  marginTop: Spacing.xs,
                  backgroundColor: colors.surface,
                  maxHeight: 150,
                  overflow: 'hidden'
                }}>
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {units.map((u, index) => (
                      <TouchableOpacity
                        key={u.id}
                        style={{
                          padding: Spacing.m,
                          borderBottomWidth: index === units.length - 1 ? 0 : 1,
                          borderBottomColor: colors.border,
                          backgroundColor: unit === u.name ? colors.primary + '10' : 'transparent'
                        }}
                        onPress={() => {
                          setUnit(u.name);
                          setShowUnitDropdown(false);
                        }}
                      >
                        <Text style={[Typography.bodyMedium, { color: unit === u.name ? colors.primary : colors.textPrimary }]}>
                          {u.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={{ marginTop: Spacing.m }}>
              <Text style={[Typography.labelSmall, { color: colors.textSecondary, marginBottom: Spacing.xs }]}>
                Safety Stock
              </Text>
              <AppTextInput
                placeholder="0"
                value={safetyStock}
                onChangeText={setSafetyStock}
                keyboardType="decimal-pad"
                editable={!saving}
              />
            </View>
            
            {editingProduct && (
              <TouchableOpacity 
                style={styles.switchContainer}
                onPress={() => !saving && setActive(!active)}
              >
                <View style={[
                  styles.switch, 
                  { backgroundColor: active ? colors.primary : colors.border }
                ]}>
                  <View style={[
                    styles.switchKnob, 
                    { 
                      backgroundColor: colors.surface,
                      alignSelf: active ? 'flex-end' : 'flex-start' 
                    }
                  ]} />
                </View>
                <Text style={[Typography.bodyMedium, { color: colors.textPrimary, marginLeft: Spacing.m }]}>
                  {active ? 'Produk Aktif' : 'Produk Nonaktif'}
                </Text>
              </TouchableOpacity>
            )}

            <AppButton
              title={saving ? 'Menyimpan...' : 'Simpan'}
              onPress={handleSave}
              disabled={saving || !name.trim() || !unit.trim() || !categoryId}
              style={styles.saveButton}
            />
            {editingProduct && (
              <AppButton
                title="Hapus Produk"
                onPress={handleDelete}
                disabled={saving}
                style={[styles.saveButton, { backgroundColor: '#FF3B30', marginTop: Spacing.s }]}
              />
            )}
          </>
        ) : activeTab === 'KATEGORI' ? (
          <>
            <AppTextInput
              label="Nama Kategori"
              placeholder="Contoh: Bahan Baku"
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
            {editingCategory && (
              <AppButton
                title="Hapus Kategori"
                onPress={handleDelete}
                disabled={saving}
                style={[styles.saveButton, { backgroundColor: '#FF3B30', marginTop: Spacing.s }]}
              />
            )}
          </>
        ) : (
          <>
            <AppTextInput
              label="Nama Satuan"
              placeholder="Contoh: kg, liter, pcs"
              value={unitName}
              onChangeText={setUnitName}
              editable={!saving}
            />
            {editingUnit && (
              <TouchableOpacity 
                style={styles.switchContainer}
                onPress={() => !saving && setUnitActive(!unitActive)}
              >
                <View style={[
                  styles.switch, 
                  { backgroundColor: unitActive ? colors.primary : colors.border }
                ]}>
                  <View style={[
                    styles.switchKnob, 
                    { 
                      backgroundColor: colors.surface,
                      alignSelf: unitActive ? 'flex-end' : 'flex-start' 
                    }
                  ]} />
                </View>
                <Text style={[Typography.bodyMedium, { color: colors.textPrimary, marginLeft: Spacing.m }]}>
                  {unitActive ? 'Satuan Aktif' : 'Satuan Nonaktif'}
                </Text>
              </TouchableOpacity>
            )}
            <AppButton
              title={saving ? 'Menyimpan...' : 'Simpan'}
              onPress={handleSave}
              disabled={saving || !unitName.trim()}
              style={styles.saveButton}
            />
            {editingUnit && (
              <AppButton
                title="Hapus Satuan"
                onPress={handleDelete}
                disabled={saving}
                style={[styles.saveButton, { backgroundColor: '#FF3B30', marginTop: Spacing.s }]}
              />
            )}
          </>
        )}
      </BottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.m,
    paddingHorizontal: Spacing.l,
    paddingTop: Spacing.xl,
  },
  backButton: {
    marginRight: Spacing.m,
  },
  searchContainer: {
    marginBottom: Spacing.m,
    paddingHorizontal: Spacing.l,
  },
  catButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#33333320', // subtle background for the icon
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.m,
  },
  cardContent: {
    flex: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    marginTop: Spacing.s,
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  tag: {
    paddingHorizontal: Spacing.s,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modalTitle: {
    marginBottom: Spacing.m,
    textAlign: 'center',
  },
  saveButton: {
    marginTop: Spacing.xl,
  },
  row: {
    flexDirection: 'row',
  },
  flex1: {
    flex: 1,
  },
  categoryScroll: {
    flexGrow: 0,
    marginBottom: Spacing.m,
  },
  categoryChip: {
    paddingHorizontal: Spacing.m,
    paddingVertical: Spacing.xs,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: Spacing.s,
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
