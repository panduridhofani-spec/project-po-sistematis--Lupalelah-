import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { AppCard } from './AppCard';
import { Typography } from '../constants/Typography';
import { Spacing } from '../constants/Colors';

interface TaskCardProps {
  title: string;
  subtitle: string;
  icon?: keyof typeof Feather.glyphMap;
  iconColor?: string;
  completed?: boolean;
  onPress?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ 
  title, 
  subtitle, 
  icon = 'alert-circle', 
  iconColor, 
  completed = false,
  onPress 
}) => {
  const { colors } = useTheme();
  
  const defaultIconColor = completed ? colors.safe : (iconColor || colors.needPo);
  const iconBackgroundColor = completed ? colors.safeLight : (iconColor ? `${iconColor}20` : colors.needPoLight);

  return (
    <AppCard onPress={onPress}>
      <View style={styles.container}>
        <View style={[styles.iconContainer, { backgroundColor: iconBackgroundColor }]}>
          <Feather name={completed ? 'check-circle' : icon} size={20} color={defaultIconColor} />
        </View>
        <View style={styles.content}>
          <Text style={[Typography.cardTitle, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[Typography.bodySecondary, { color: colors.textSecondary }]}>{subtitle}</Text>
        </View>
        {!completed && onPress && (
          <Feather name="arrow-right" size={20} color={colors.primary} />
        )}
      </View>
    </AppCard>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.m,
  },
  content: {
    flex: 1,
    marginRight: Spacing.m,
  },
});
