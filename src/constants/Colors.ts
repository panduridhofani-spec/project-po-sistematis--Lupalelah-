export const lightColors = {
  background: '#FDFCF0', // cream / off-white
  surface: '#FFFFFF', // pure white for cards
  surfaceElevated: '#FFFFFF',
  primary: '#3E2723', // dark coffee brown (for main text and accents)
  primaryDark: '#291814',
  textPrimary: '#2D1B16', // dark charcoal brown
  textSecondary: '#795548', // muted brown
  textMuted: '#A0938F',
  border: '#E8E1DA',
  
  // Semantic / Status (Pastel backgrounds, strong text)
  safe: '#2E7D32', // green text/icon
  needPo: '#E65100', // orange text/icon
  outOfStock: '#C62828', // red text/icon
  
  // Background variants for stat cards
  safeLight: '#E0F0E3', // pastel green bg
  needPoLight: '#FCEBDB', // pastel orange bg
  outOfStockLight: '#FBE0E0', // pastel red bg
  primaryLight: '#3E272315', // light primary tint
  
  // Custom theme colors
  cardStockOpname: '#EFE3D5', // tan / warm beige for main card
};

export const darkColors = {
  background: '#121212',
  surface: '#1E1E1E', 
  surfaceElevated: '#242424',
  primary: '#D7CCC8', // very light brown
  primaryDark: '#BCAAA4',
  textPrimary: '#F5F5F5', 
  textSecondary: '#B0BEC5',
  textMuted: '#78909C',
  border: '#303030',
  
  safe: '#81C784', 
  needPo: '#FFB74D', 
  outOfStock: '#E57373',
  
  safeLight: '#1B5E20',
  needPoLight: '#E6510066',
  outOfStockLight: '#B71C1C',
  primaryLight: '#D7CCC820',
  
  cardStockOpname: '#3E2723', // dark coffee for dark mode card
};

// Fallback export for backward compatibility during refactor, but we should use the hook
export const Colors = lightColors;

export type ThemeColors = typeof lightColors;

export const Spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
};

export const Radius = {
  small: 8,
  medium: 12, // input/button
  large: 16, // card
  xlarge: 24, // bottom sheet/modal
};
