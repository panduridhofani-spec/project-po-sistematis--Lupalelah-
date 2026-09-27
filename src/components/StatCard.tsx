import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Colors, Spacing, Radius } from '../constants/Colors';
import { Typography } from '../constants/Typography';

interface StatCardProps {
  number: number | string;
  label: string;
  color?: string;
  bgColor?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
}

export const StatCard: React.FC<StatCardProps> = ({ number, label, color, bgColor, icon }) => {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.container, { backgroundColor: bgColor || 'transparent' }]}>
      <View style={styles.topRow}>
        <Text style={[Typography.stockNumber, { color: color || colors.textPrimary }]}>{number}</Text>
        {icon && (
          <View style={[styles.iconWrapper, { backgroundColor: color }]}>
             <MaterialCommunityIcons name={icon} size={14} color="#FFF" />
          </View>
        )}
      </View>
      <Text style={[Typography.bodyMedium, styles.label, { color: color || colors.textSecondary }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.m,
    borderRadius: Radius.large,
    marginHorizontal: Spacing.xs / 2,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    minHeight: 110,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'flex-start',
  },
  iconWrapper: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: Spacing.m,
    fontWeight: '600',
  },
});
