import React from 'react';
import { View, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Radius, Spacing } from '../constants/Colors';

export const SearchBar: React.FC<TextInputProps> = (props) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      <Feather name="search" size={20} color={colors.textSecondary} style={styles.icon} />
      <TextInput
        style={[styles.input, { color: colors.textPrimary }]}
        placeholderTextColor={colors.textSecondary}
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: Radius.medium,
    borderWidth: 1,
    paddingHorizontal: Spacing.m,
    marginBottom: Spacing.m,
  },
  icon: {
    marginRight: Spacing.s,
  },
  input: {
    flex: 1,
    fontSize: 15,
  }
});
