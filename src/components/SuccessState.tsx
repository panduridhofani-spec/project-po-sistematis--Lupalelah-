import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Typography } from '../constants/Typography';
import { Spacing } from '../constants/Colors';
import { AppButton } from './AppButton';

interface SuccessStateProps {
  title?: string;
  message?: string;
  onContinue?: () => void;
  continueText?: string;
}

export const SuccessState: React.FC<SuccessStateProps> = ({ 
  title = 'Completed Successfully', 
  message, 
  onContinue,
  continueText = 'Continue'
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: colors.safeLight }]}>
        <Feather name="check" size={32} color={colors.safe} />
      </View>
      <Text style={[Typography.cardTitle, styles.title, { color: colors.textPrimary }]}>{title}</Text>
      {message && (
        <Text style={[Typography.bodyMedium, styles.message, { color: colors.textSecondary }]}>{message}</Text>
      )}
      {onContinue && (
        <AppButton title={continueText} onPress={onContinue} style={styles.button} />
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
