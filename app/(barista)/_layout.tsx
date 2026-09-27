import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useTheme } from '../../src/context/ThemeContext';

export default function BaristaLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          paddingTop: 12,
          elevation: 0, // remove Android shadow
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerShadowVisible: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false, // Custom header in screen
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home-variant-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: 'Stock',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="package-variant-closed" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="po"
        options={{
          title: 'PO',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="clipboard-text-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-circle-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stock-taking"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="regular-po"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="urgent-po"
        options={{ href: null }}
      />
    </Tabs>
  );
}
