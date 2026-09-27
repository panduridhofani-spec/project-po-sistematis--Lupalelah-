import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Typography } from '../constants/Typography';
import { Spacing, Radius } from '../constants/Colors';

interface ProgressCardProps {
  title: string;
  percentage: number;
  subtitle: string;
}

export const ProgressCard: React.FC<ProgressCardProps> = ({ title, percentage, subtitle }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: (colors as any).cardStockOpname || '#F4E9DC' }]}>
      <View style={styles.leftContent}>
        <Text style={[Typography.sectionTitle, { color: colors.primary, marginBottom: 4 }]}>{title}</Text>
        <Text style={[Typography.bodyMedium, { color: colors.textPrimary, opacity: 0.8, marginBottom: Spacing.l }]}>{subtitle}</Text>
        <Text style={[Typography.bodySmall, { color: colors.textPrimary, opacity: 0.6 }]}>
          Cek stok penutup untuk detail
        </Text>
      </View>
      
      <View style={styles.rightContent}>
        <View style={[styles.circleOuter, { borderColor: colors.primary }]}>
           <View style={styles.circleInner}>
              <Text style={[Typography.stockNumber, { color: colors.primary, fontSize: 24 }]}>{percentage}%</Text>
           </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: Radius.xlarge,
    padding: Spacing.xl,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.l,
  },
  leftContent: {
    flex: 1,
    paddingRight: Spacing.m,
  },
  rightContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderLeftColor: 'transparent', // creates a partial ring effect
    borderBottomColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-45deg' }], // rotates the gap
  },
  circleInner: {
    transform: [{ rotate: '45deg' }], // un-rotates the text
    alignItems: 'center',
    justifyContent: 'center',
  }
});
