import React from 'react';
import { TextInput, TextInputProps, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Radius, Spacing } from '../constants/Colors';
import { Typography } from '../constants/Typography';

interface AppTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const AppTextInput: React.FC<AppTextInputProps> = ({ label, error, style, ...props }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {label && <Text style={[Typography.bodyMedium, styles.label, { color: colors.textPrimary }]}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          { 
            backgroundColor: colors.surface, 
            borderColor: colors.border,
            color: colors.textPrimary 
          },
          error ? { borderColor: colors.outOfStock } : null,
          style,
        ]}
        placeholderTextColor={colors.textSecondary}
        {...props}
      />
      {error && <Text style={[Typography.labelSmall, { color: colors.outOfStock, marginTop: Spacing.xs }]}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.l,
    width: '100%',
  },
  label: {
    marginBottom: Spacing.s,
    fontFamily: 'Poppins_500Medium',
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.m,
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
  },
});
