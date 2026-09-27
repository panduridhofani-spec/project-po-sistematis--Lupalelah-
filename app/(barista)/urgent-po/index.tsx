import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { AppCard } from '../../../src/components/AppCard';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { FadeInView } from '../../../src/components/FadeInView';
import { Typography } from '../../../src/constants/Typography';
import { Spacing } from '../../../src/constants/Colors';
import { useTheme } from '../../../src/context/ThemeContext';
import { db } from '../../../src/lib/firebase';
import { collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import { PurchaseOrder } from '../../../src/types/stock';

export default function UrgentPOListScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);

  useEffect(() => {
    fetchPOs();
  }, []);

  const fetchPOs = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'purchase_orders'), 
        where('type', '==', 'URGENT')
      );
      const snap = await getDocs(q);
      const posData: PurchaseOrder[] = [];
      snap.forEach(d => posData.push({ id: d.id, ...d.data() } as unknown as PurchaseOrder));
      
      posData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setPos(posData);
    } catch (error) {
      console.error('Error fetching Urgent POs:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item, index }: { item: PurchaseOrder, index: number }) => (
    <FadeInView delay={index * 100}>
      <TouchableOpacity onPress={() => router.push(`/(barista)/urgent-po/${item.id}`)}>
        <AppCard style={[styles.card, { borderColor: colors.outOfStock, borderWidth: 1 }]}>
          <View style={styles.cardHeader}>
            <Text style={[Typography.cardTitle, { color: colors.textPrimary }]}>
              UPO-{item.id.split('-')[0].toUpperCase()}
            </Text>
            <StatusBadge status={item.status} />
          </View>
          <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginTop: Spacing.xs }]}>
            Tanggal: {item.operational_date}
          </Text>
          <View style={styles.shiftRow}>
            <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>
              Sumber: Shift {item.source_shift_number}
            </Text>
            <Feather name="arrow-right" size={16} color={colors.textSecondary} style={{ marginHorizontal: Spacing.xs }} />
            <Text style={[Typography.bodyMedium, { color: colors.outOfStock }]}>
              Tujuan: {item.target_shift_number ? `Shift ${item.target_shift_number}` : 'Menunggu Logistik'}
            </Text>
          </View>
        </AppCard>
      </TouchableOpacity>
    </FadeInView>
  );

  return (
    <ScreenContainer padding={false}>
      <FadeInView delay={0}>
        <View style={[styles.header, { padding: Spacing.l }]}>
          <TouchableOpacity onPress={() => router.replace('/(barista)')} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[Typography.screenTitle, { color: colors.textPrimary }]}>PO Mendesak</Text>
        </View>
      </FadeInView>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : (
        <FlatList
          data={pos}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <FadeInView delay={100}>
              <View style={styles.emptyContainer}>
                <Feather name="alert-circle" size={48} color={colors.border} style={{ marginBottom: Spacing.m }} />
                <Text style={[Typography.cardTitle, { color: colors.textSecondary }]}>Belum ada PO Mendesak</Text>
              </View>
            </FadeInView>
          }
        />
      )}

      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: colors.outOfStock }]}
        onPress={() => router.push('/(barista)/urgent-po/create')}
      >
        <Feather name="plus" size={24} color={colors.surface} />
      </TouchableOpacity>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: Spacing.m,
  },
  listContent: {
    padding: Spacing.l,
    paddingBottom: Spacing.xxl * 2,
  },
  card: {
    marginBottom: Spacing.m,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.l,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  }
});
