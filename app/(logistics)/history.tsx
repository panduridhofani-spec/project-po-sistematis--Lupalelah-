import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { AppCard } from '../../src/components/AppCard';
import { FadeInView } from '../../src/components/FadeInView';
import { Typography } from '../../src/constants/Typography';
import { Spacing, Radius } from '../../src/constants/Colors';
import { db } from '../../src/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { AppTextInput } from '../../src/components/AppTextInput';
import { FilterChip } from '../../src/components/FilterChip';

type HistoryItem = {
  id: string;
  type: 'REGULAR' | 'URGENT';
  date: string;
  shift: number;
  time: string;
  status: string;
};

export default function LogisticsHistory() {
  const { colors } = useTheme();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'Terbaru' | 'Terlama'>('Terbaru');
  const [filterPeriod, setFilterPeriod] = useState<'Semua' | 'Seminggu'>('Semua');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const q = query(
        collection(db, 'purchase_orders'),
        where('status', 'in', ['COMPLETE', 'VALIDATED'])
      );
      const snap = await getDocs(q);
      
      const merged: HistoryItem[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        
        // Hide history older than 30 days from creation
        const createdAt = new Date(data.created_at || new Date().toISOString()).getTime();
        const now = Date.now();
        const days30 = 30 * 24 * 60 * 60 * 1000;
        
        if (now - createdAt <= days30) {
          merged.push({
            id: docSnap.id,
            type: data.type as 'REGULAR' | 'URGENT',
            date: data.operational_date,
            shift: data.source_shift_number,
            time: data.processed_at || data.created_at,
            status: data.status
          });
        }
      });
      // Initial sort by newest
      merged.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      
      setHistoryItems(merged.slice(0, 100)); // Increased limit slightly since we have filters
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const filteredAndSortedItems = historyItems.filter(item => {
    // 1. Search Filter (by Shift Number / PO Title)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const title = `${item.type === 'URGENT' ? 'Urgent ' : ''}PO Shift ${item.shift}`.toLowerCase();
      if (!title.includes(q)) {
        return false;
      }
    }
    
    // 2. Period Filter
    if (filterPeriod === 'Seminggu') {
      const itemTime = new Date(item.time).getTime();
      const now = Date.now();
      if (now - itemTime > 7 * 24 * 60 * 60 * 1000) {
        return false;
      }
    }
    
    return true;
  }).sort((a, b) => {
    const timeA = new Date(a.time).getTime();
    const timeB = new Date(b.time).getTime();
    return sortOrder === 'Terbaru' ? timeB - timeA : timeA - timeB;
  });

  return (
    <ScreenContainer padding={false}>
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={[Typography.screenTitle, { color: colors.textPrimary }]}>Riwayat PO</Text>
        <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginBottom: Spacing.m }]}>Daftar pesanan yang telah selesai</Text>
        
        <AppTextInput 
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Cari PO Shift (misal: Shift 3)..."
          icon="magnify"
        />
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: Spacing.m }}>
          <FilterChip 
            label="Semua Waktu" 
            active={filterPeriod === 'Semua'} 
            onPress={() => setFilterPeriod('Semua')} 
          />
          <FilterChip 
            label="Seminggu Terakhir" 
            active={filterPeriod === 'Seminggu'} 
            onPress={() => setFilterPeriod('Seminggu')} 
          />
          <View style={{ width: Spacing.m }} />
          <FilterChip 
            label="Terbaru" 
            active={sortOrder === 'Terbaru'} 
            onPress={() => setSortOrder('Terbaru')} 
          />
          <FilterChip 
            label="Terlama" 
            active={sortOrder === 'Terlama'} 
            onPress={() => setSortOrder('Terlama')} 
          />
        </ScrollView>
      </View>

      <ScrollView 
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filteredAndSortedItems.length === 0 ? (
          <FadeInView delay={100}>
            <View style={styles.centerContainer}>
              <MaterialCommunityIcons name="history" size={48} color={colors.border} style={{ marginBottom: Spacing.m }} />
              <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>Belum ada riwayat pesanan.</Text>
            </View>
          </FadeInView>
        ) : (
          <View style={styles.timelineContainer}>
            {filteredAndSortedItems.map((item, index) => {
              const isUrgent = item.type === 'URGENT';
              const iconColor = isUrgent ? colors.outOfStock : colors.primary;
              const bgColor = isUrgent ? colors.outOfStockLight : colors.primaryLight;
              const isLast = index === filteredAndSortedItems.length - 1;
              
              const formattedDate = new Date(item.time).toLocaleString('id-ID', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
              });

              return (
                <FadeInView key={`${item.type}-${item.id}`} delay={100 + (index * 50)}>
                  <View style={styles.timelineRow}>
                    {/* Timeline Line & Dot */}
                    <View style={styles.timelineIndicator}>
                      <View style={[styles.dot, { backgroundColor: iconColor }]} />
                      {!isLast && <View style={[styles.line, { backgroundColor: colors.border }]} />}
                    </View>
                    
                    {/* Content Card */}
                    <View style={styles.timelineContent}>
                      <TouchableOpacity onPress={() => {
                        if (isUrgent) {
                          router.push(`/(logistics)/urgent-po/${item.id}?from=history`);
                        } else {
                          router.push(`/(logistics)/regular-po/${item.id}?from=history`);
                        }
                      }}>
                        <AppCard style={[styles.historyCard, { borderColor: bgColor, borderWidth: 1 }]}>
                          <View style={styles.cardHeader}>
                            <View style={styles.titleRow}>
                              <View style={[styles.iconBox, { backgroundColor: bgColor }]}>
                                <MaterialCommunityIcons name={isUrgent ? 'truck-fast' : 'package-variant-closed'} size={18} color={iconColor} />
                              </View>
                              <Text style={[Typography.cardTitle, { color: colors.textPrimary, marginLeft: Spacing.s }]}>
                                {isUrgent ? 'Urgent ' : ''}PO Shift {item.shift}
                              </Text>
                            </View>
                            <Text style={[Typography.labelSmall, { color: colors.textSecondary }]}>{formattedDate}</Text>
                          </View>
                          
                          <View style={styles.cardBody}>
                            <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>
                              {item.status === 'VALIDATED' ? 'Divalidasi' : 'Diselesaikan'} untuk <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>Shift {item.shift}</Text>
                            </Text>
                            <Text style={[Typography.bodySmall, { color: colors.textSecondary, marginTop: Spacing.xs }]}>
                              Tgl Operasional: {item.date}
                            </Text>
                          </View>
                        </AppCard>
                      </TouchableOpacity>
                    </View>
                  </View>
                </FadeInView>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: Spacing.l,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.m,
  },
  listContent: {
    padding: Spacing.l,
    paddingBottom: Spacing.xxl * 2,
  },
  centerContainer: {
    paddingVertical: Spacing.xxl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineContainer: {
    paddingTop: Spacing.s,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  timelineIndicator: {
    alignItems: 'center',
    width: 30,
    marginRight: Spacing.m,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 6,
    zIndex: 1,
  },
  line: {
    width: 2,
    flex: 1,
    marginTop: -8,
    marginBottom: -6,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: Spacing.l,
  },
  historyCard: {
    padding: Spacing.m,
    borderRadius: Radius.medium,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.s,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    marginLeft: 36, // Align with text after icon
  }
});
