import React from 'react';
import { View, StyleSheet, ViewProps, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Radius, Spacing } from '../constants/Colors';

interface AppCardProps extends ViewProps {
  onPress?: () => void;
  noPadding?: boolean;
}

export const AppCard: React.FC<AppCardProps> = ({ 
  children, 
  onPress,
  noPadding = false,
  style, 
  ...props 
}) => {
  const { colors } = useTheme();
  const CardContainer = onPress ? TouchableOpacity : View;

  return (
    <CardContainer
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        !noPadding && styles.padding,
        style
      ]}
      {...props as any}
    >
      {children}
    </CardContainer>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.large,
    borderWidth: 1,
    marginBottom: Spacing.m,
    // Very subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1, // for Android
  },
  padding: {
    padding: Spacing.l,
  },
});
