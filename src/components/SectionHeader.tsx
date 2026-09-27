import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Colors, Spacing } from '../constants/Colors';
import { Typography } from '../constants/Typography';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[Typography.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      {subtitle && (
        <Text style={[Typography.bodySecondary, styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.m,
  },
  subtitle: {
    marginTop: Spacing.xs,
  },
});
