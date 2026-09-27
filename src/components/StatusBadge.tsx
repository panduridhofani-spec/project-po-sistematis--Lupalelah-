import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Radius, Spacing } from '../constants/Colors';
import { StockStatus } from '../types';

interface StatusBadgeProps {
  status: StockStatus | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const { colors } = useTheme();
  let backgroundColor = colors.safe;
  let label = 'SAFE';

  if (status === 'NEED_PO' || status === 'Need PO' || status === 'NEED PO') {
    backgroundColor = colors.needPo;
    label = 'NEED PO';
  } else if (status === 'OUT_OF_STOCK' || status === 'Out' || status === 'URGENT') {
    backgroundColor = colors.outOfStock;
    label = status === 'URGENT' ? 'URGENT' : 'OUT OF STOCK';
  } else if (status === 'SAFE' || status === 'Safe' || status === 'COMPLETE' || status === 'DONE') {
    backgroundColor = colors.safe;
    label = status.toString().toUpperCase();
  } else if (status === 'PARTIAL') {
    backgroundColor = colors.needPo;
    label = 'PARTIAL';
  } else {
    // For general badges like "ACTIVE" or "PENDING"
    backgroundColor = colors.primary;
    label = status.toString().toUpperCase();
  }

  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={[styles.text, { color: colors.surface }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.s,
    paddingVertical: 2,
    borderRadius: Radius.small,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
