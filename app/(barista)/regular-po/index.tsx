import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { AppCard } from '../../../src/components/AppCard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { FadeInView } from '../../../src/components/FadeInView';
import { Typography } from '../../../src/constants/Typography';
import { Spacing } from '../../../src/constants/Colors';
import { useTheme } from '../../../src/context/ThemeContext';
import { db } from '../../../src/lib/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { PurchaseOrder } from '../../../src/types/stock';

export default function RegularPOListScreen() {
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
      const q = query(collection(db, 'purchase_orders'), orderBy('created_at', 'desc'));
      const snap = await getDocs(q);
      const posData: PurchaseOrder[] = [];
      snap.forEach(d => posData.push({ id: d.id, ...d.data() } as unknown as PurchaseOrder));
      setPos(posData);
    } catch (error) {
      console.error('Error fetching POs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return '#F5A623'; // Orange
      case 'SENT': return '#4A90E2'; // Blue
      case 'VALIDATED': return '#9B51E0'; // Purple
      case 'COMPLETE': return '#4CAF50'; // Green
      case 'PARTIAL': return '#F8E71C'; // Yellow
      default: return colors.primary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return 'clock-outline';
      case 'SENT': return 'truck-fast-outline';
      case 'VALIDATED': return 'check-decagram-outline';
      case 'COMPLETE': return 'check-all';
      default: return 'package-variant';
    }
  };

  const renderItem = ({ item, index }: { item: PurchaseOrder, index: number }) => {
    const statusColor = getStatusColor(item.status);
    const iconName = getStatusIcon(item.status);
    
    return (
      <FadeInView delay={index * 100}>
        <TouchableOpacity onPress={() => router.push(`/(barista)/regular-po/${item.id}`)} activeOpacity={0.8}>
          <AppCard style={[styles.premiumCard, { borderColor: statusColor, shadowColor: statusColor }]}>
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.iconBox, { backgroundColor: statusColor + '20' }]}>
                  <MaterialCommunityIcons name={iconName as any} size={20} color={statusColor} />
                </View>
                <Text style={[Typography.cardTitle, { color: colors.textPrimary, marginLeft: Spacing.s }]}>
                  PO-{item.id.split('-')[0].toUpperCase()}
                </Text>
              </View>
              <View style={[styles.customBadge, { backgroundColor: statusColor + '15', borderColor: statusColor }]}>
                <Text style={[styles.customBadgeText, { color: statusColor }]}>{item.status}</Text>
              </View>
            </View>
            
            <View style={styles.cardBody}>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="calendar-edit" size={16} color={colors.textSecondary} />
                <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginLeft: 6 }]}>
                  Dibuat: Shift {item.source_shift_number} ({item.operational_date})
                </Text>
              </View>
              
              {item.target_shift_number && (
                <View style={[styles.infoRow, { marginTop: 8 }]}>
                  <MaterialCommunityIcons name="target" size={16} color={statusColor} />
                  <Text style={[Typography.bodyMedium, { color: statusColor, marginLeft: 6, fontWeight: 'bold' }]}>
                    Target Terima: Shift {item.target_shift_number} ({item.target_operational_date})
                  </Text>
                </View>
              )}
            </View>
          </AppCard>
        </TouchableOpacity>
      </FadeInView>
    );
  };

  return (
    <ScreenContainer padding={false}>
      <FadeInView delay={0}>
        <View style={[styles.header, { padding: Spacing.l }]}>
          <TouchableOpacity onPress={() => router.replace('/(barista)')} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[Typography.screenTitle, { color: colors.textPrimary }]}>PO Reguler</Text>
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
                <Feather name="file-text" size={48} color={colors.border} style={{ marginBottom: Spacing.m }} />
                <Text style={[Typography.cardTitle, { color: colors.textSecondary }]}>Belum ada PO Reguler</Text>
              </View>
            </FadeInView>
          }
        />
      )}

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
  premiumCard: {
    marginBottom: Spacing.m,
    borderWidth: 1,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    padding: Spacing.m,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.m,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  customBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  cardBody: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: Spacing.s,
    borderRadius: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
  }
});
