import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Typography } from '../constants/Typography';
import { Spacing } from '../constants/Colors';
import { AppButton } from './AppButton';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ 
  title = 'Something went wrong', 
  message = "We couldn't load this information.", 
  onRetry 
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: colors.outOfStockLight }]}>
        <Feather name="alert-triangle" size={32} color={colors.outOfStock} />
      </View>
      <Text style={[Typography.cardTitle, styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[Typography.bodyMedium, styles.message, { color: colors.textSecondary }]}>{message}</Text>
      {onRetry && (
        <AppButton title="Try Again" onPress={onRetry} variant="secondary" style={styles.button} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    flex: 1,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.l,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  message: {
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  button: {
    minWidth: 150,
  }
});
