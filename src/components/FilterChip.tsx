import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Radius, Spacing } from '../constants/Colors';
import { Typography } from '../constants/Typography';

interface FilterChipProps {
  label: string;
  active?: boolean;
  onPress: () => void;
}

export const FilterChip: React.FC<FilterChipProps> = ({ label, active = false, onPress }) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[
        Typography.labelSmall,
        { color: active ? colors.surface : colors.textSecondary },
        styles.text
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.m,
    paddingVertical: 8,
    borderRadius: 20, // pill shape
    borderWidth: 1,
    marginRight: Spacing.s,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: '600',
  }
});
