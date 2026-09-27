import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { FilterChip } from '../../src/components/FilterChip';
import { TaskCard } from '../../src/components/TaskCard';
import { AppCard } from '../../src/components/AppCard';
import { StatCard } from '../../src/components/StatCard';
import { Typography } from '../../src/constants/Typography';
import { Spacing } from '../../src/constants/Colors';

type POFilter = 'All' | 'Pending' | 'Completed';

export default function AdminPO() {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<POFilter>('All');
  const filters: POFilter[] = ['All', 'Pending', 'Completed'];

  return (
    <ScreenContainer padding={false}>
      <View style={styles.header}>
        <Text style={[Typography.screenTitle, { color: colors.textPrimary, marginBottom: Spacing.m }]}>PO Activity</Text>
        
        <View style={styles.summaryRow}>
          <AppCard style={styles.summaryCard}>
            <StatCard number={4} label="Pending" />
          </AppCard>
          <View style={{ width: Spacing.s }} />
          <AppCard style={styles.summaryCard}>
            <StatCard number={12} label="Completed" color={colors.safe} />
          </AppCard>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {filters.map(f => (
            <FilterChip 
              key={f}
              label={f}
              active={filter === f}
              onPress={() => setFilter(f)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        <Text style={[Typography.sectionTitle, { color: colors.textPrimary, marginBottom: Spacing.m }]}>Recent Orders</Text>
        
        <TaskCard 
          title="PO-2026-0043" 
          subtitle="Urgent PO · 12 items"
          icon="alert-circle"
          iconColor={colors.outOfStock}
          onPress={() => {}}
        />
        
        <TaskCard 
          title="PO-2026-0042" 
          subtitle="Regular PO · 45 items"
          icon="file-text"
          iconColor={colors.needPo}
          onPress={() => {}}
        />
        
        <TaskCard 
          title="PO-2026-0041" 
          subtitle="Regular PO · 15 items"
          icon="file-text"
          iconColor={colors.primary}
          onPress={() => {}}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: Spacing.l,
    paddingBottom: 0,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.m,
  },
  summaryCard: {
    flex: 1,
    paddingVertical: Spacing.m,
    paddingHorizontal: Spacing.xs,
  },
  chipRow: {
    marginBottom: Spacing.m,
  },
  listContent: {
    padding: Spacing.l,
    paddingBottom: Spacing.xxl,
  },
});
