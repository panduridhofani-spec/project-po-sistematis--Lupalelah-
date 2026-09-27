import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Typography } from '../constants/Typography';
import { Spacing } from '../constants/Colors';

interface ActivityItemProps {
  title: string;
  time: string;
  icon?: keyof typeof Feather.glyphMap;
  isLast?: boolean;
}

export const ActivityItem: React.FC<ActivityItemProps> = ({ title, time, icon = 'activity', isLast = false }) => {
  const { colors } = useTheme();

  return (
    <>
      <View style={styles.container}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
          <Feather name={icon} size={16} color={colors.primary} />
        </View>
        <View style={styles.content}>
          <Text style={[Typography.bodyMedium, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[Typography.bodySecondary, { color: colors.textSecondary }]}>{time}</Text>
        </View>
      </View>
      {!isLast && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.s,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.m,
  },
  content: {
    flex: 1,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.s,
  },
});
