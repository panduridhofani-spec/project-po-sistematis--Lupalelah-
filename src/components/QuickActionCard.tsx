import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Radius, Spacing } from '../constants/Colors';
import { Typography } from '../constants/Typography';

interface QuickActionCardProps {
  title: string;
  icon: React.ReactNode;
  onPress: () => void;
  accent?: boolean;
  danger?: boolean;
  style?: any;
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({ title, icon, onPress, accent = false, danger = false, style }) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.card, 
        { backgroundColor: colors.surface },
        style
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[
        styles.iconContainer, 
        { backgroundColor: '#F4E9DC' }, // default coffee tan
        accent && { backgroundColor: colors.primary },
        danger && { backgroundColor: colors.outOfStock }
      ]}>
        {icon}
      </View>
      <Text style={[
        Typography.bodyMedium, 
        { color: colors.textPrimary, fontWeight: '600' },
        styles.text
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xlarge,
    padding: Spacing.m,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    // Soft drop shadow
    shadowColor: '#3E2723',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.m,
  },
  text: {
    textAlign: 'center',
  },
});
