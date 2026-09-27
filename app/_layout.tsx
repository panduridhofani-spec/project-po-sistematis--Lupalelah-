import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { AppAlert } from '../src/components/AppAlert';
import { syncServerTime } from '../src/utils/date';

import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../src/constants/Colors';
import { 
  useFonts, 
  Poppins_400Regular, 
  Poppins_500Medium, 
  Poppins_600SemiBold, 
  Poppins_700Bold 
} from '@expo-google-fonts/poppins';

function useProtectedRoute() {
  const { user, role, isLoading, profile, activeShift, signOut } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'login';
    const isSelectShift = segments[0] === 'select-shift';
    const hasSession = !!user;

    if (!hasSession && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/login');
    } else if (hasSession) {
      // Check if profile is loaded and active
      if (!profile) {
        return;
      }
      
      if (!profile.active) {
        signOut();
        return;
      }

      // Role-based routing
      if (inAuthGroup) {
        if (role === 'MASTER_ADMIN') {
          router.replace('/(admin)');
        } else if (role === 'LOGISTICS') {
          router.replace('/(logistics)');
        } else if (role === 'LEADER_BARISTA') {
          if (activeShift === null) {
            router.replace('/select-shift');
          } else {
            router.replace('/(barista)');
          }
        }
      } else {
        // Prevent accessing wrong areas
        const currentGroup = segments[0];
        
        if (role === 'MASTER_ADMIN' && currentGroup !== '(admin)') {
          router.replace('/(admin)');
        } else if (role === 'LOGISTICS' && currentGroup !== '(logistics)') {
          router.replace('/(logistics)');
        } else if (role === 'LEADER_BARISTA') {
          if (activeShift === null && !isSelectShift) {
            router.replace('/select-shift');
          } else if (activeShift !== null && currentGroup !== '(barista)') {
            router.replace('/(barista)');
          }
        }
      }
    }
  }, [user, role, isLoading, segments, profile, activeShift]);
}

function RootLayoutNav() {
  const { isDark, colors } = useTheme();
  const { isLoading } = useAuth();
  
  useProtectedRoute();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="select-shift" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(barista)" />
        <Stack.Screen name="(logistics)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    syncServerTime();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <ThemeProvider>
        <>
          <RootLayoutNav />
          <AppAlert key="app-alert-v2" />
        </>
      </ThemeProvider>
    </AuthProvider>
  );
}
