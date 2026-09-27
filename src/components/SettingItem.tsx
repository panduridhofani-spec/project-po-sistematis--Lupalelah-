import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Typography } from '../constants/Typography';
import { Spacing } from '../constants/Colors';

interface SettingItemProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  isDanger?: boolean;
}

export const SettingItem: React.FC<SettingItemProps> = ({ icon, title, subtitle, onPress, isDanger }) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.iconContainer}>
        <Feather name={icon} size={20} color={isDanger ? colors.outOfStock : colors.textSecondary} />
      </View>
      <View style={styles.content}>
        <Text style={[Typography.cardTitle, { color: isDanger ? colors.outOfStock : colors.textPrimary }]}>{title}</Text>
        {subtitle && (
          <Text style={[Typography.bodySecondary, { color: colors.textSecondary, marginTop: 2 }]}>{subtitle}</Text>
        )}
      </View>
      {onPress && !isDanger && (
        <Feather name="chevron-right" size={20} color={colors.textSecondary} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.m,
    paddingHorizontal: Spacing.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconContainer: {
    marginRight: Spacing.m,
    width: 24,
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
});
