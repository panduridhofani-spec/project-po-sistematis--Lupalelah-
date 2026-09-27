import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { Spacing } from '../constants/Colors';

interface ScreenContainerProps extends ViewProps {
  children: React.ReactNode;
  padding?: boolean;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({ 
  children, 
  padding = true,
  style, 
  ...props 
}) => {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View 
        style={[
          styles.container, 
          { backgroundColor: colors.background },
          padding && styles.padding,
          style
        ]} 
        {...props}
      >
        {children}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  padding: {
    padding: Spacing.l,
  },
});
