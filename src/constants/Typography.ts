import { StyleSheet } from 'react-native';
import { Colors } from './Colors';

export const Typography = StyleSheet.create({
  screenTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 28, // Increased for impact
    color: Colors.textPrimary,
  },
  sectionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
  },
  cardTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: Colors.textPrimary,
  },
  bodyLarge: {
    fontFamily: 'Poppins_500Medium', // slightly bolder for better readability in modern UI
    fontSize: 15,
    color: Colors.textPrimary,
  },
  bodyMedium: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  bodySecondary: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  bodySmall: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: Colors.textPrimary,
  },
  labelSmall: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  stockNumber: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 32,
    color: Colors.textPrimary,
  },
});
