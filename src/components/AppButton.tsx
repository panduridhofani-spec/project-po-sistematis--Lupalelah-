import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps, ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Radius } from '../constants/Colors';
import { Typography } from '../constants/Typography';

interface AppButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
}

export const AppButton: React.FC<AppButtonProps> = ({ 
  title, 
  variant = 'primary', 
  loading = false, 
  style, 
  disabled, 
  ...props 
}) => {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isPrimary ? { backgroundColor: colors.primary } : { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
        isDisabled && styles.disabled,
        style,
      ]}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.surface : colors.primary} />
      ) : (
        <Text
          style={[
            Typography.cardTitle,
            { color: isPrimary ? colors.surface : colors.primary },
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: Radius.medium, // 12px
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  disabled: {
    opacity: 0.6,
  },
});
