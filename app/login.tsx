import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AppButton } from '../src/components/AppButton';
import { AppTextInput } from '../src/components/AppTextInput';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { AppCard } from '../src/components/AppCard';
import { Spacing, Radius } from '../src/constants/Colors';
import { Typography } from '../src/constants/Typography';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { ActivityIndicator } from 'react-native';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg('Email dan password harus diisi.');
      return;
    }
    
    setErrorMsg('');
    setIsLoading(true);
    
    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrorMsg('Email atau password salah.');
        } else if (error.message.includes('Network')) {
          setErrorMsg('Baterai koneksi bermasalah. Coba lagi.');
        } else {
          setErrorMsg(error.message);
        }
      }
    } catch (e) {
      setErrorMsg('Terjadi kesalahan yang tidak terduga.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer padding={false}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false} showsVerticalScrollIndicator={false}>
          
          <View style={styles.contentWrapper}>
            {/* Brand & Header Section */}
            <View style={styles.header}>
              <View style={[styles.logoContainer, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.primary }]}>
                <Image 
                  source={require('../assets/images/logo.jpg')} 
                  style={{ width: '100%', height: '100%', borderRadius: Radius.large - 1 }} 
                  resizeMode="cover" 
                />
              </View>
              <Text style={[Typography.screenTitle, styles.title, { color: colors.textPrimary }]}>
                Cafe Stock
              </Text>
              <Text style={[Typography.bodyMedium, styles.subtitle, { color: colors.textSecondary }]}>
                Sistem Manajemen Stok & Inventaris
              </Text>
            </View>

            {/* Form Section */}
            <AppCard style={styles.formCard}>
              <View style={styles.inputWrapper}>
                <AppTextInput
                  label="Email"
                  placeholder="Masukkan email Anda"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              
              <View style={styles.inputWrapper}>
                <AppTextInput
                  label="Password"
                  placeholder="Masukkan password Anda"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              {errorMsg ? (
                <View style={[styles.errorContainer, { backgroundColor: colors.outOfStock + '15' }]}>
                  <Feather name="alert-circle" size={16} color={colors.outOfStock} style={{ marginRight: Spacing.xs }} />
                  <Text style={[Typography.bodyMedium, { color: colors.outOfStock, flex: 1 }]}>
                    {errorMsg}
                  </Text>
                </View>
              ) : null}

              <View style={styles.buttonWrapper}>
                {isLoading ? (
                  <ActivityIndicator size="large" color={colors.primary} />
                ) : (
                  <AppButton 
                    title="Masuk ke Akun" 
                    onPress={handleLogin}
                  />
                )}
              </View>
            </AppCard>

            <Text style={[Typography.labelSmall, styles.footerText, { color: colors.textMuted }]}>
              © 2026 Cafe Management System
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  contentWrapper: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    width: '100%',
  },
  logoContainer: {
    width: 140,
    height: 140,
    borderRadius: Radius.large,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    marginBottom: Spacing.xs,
    fontSize: 32,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: Spacing.m,
  },
  formCard: {
    width: '100%',
    padding: Spacing.xl,
    borderRadius: Radius.large,
    marginBottom: Spacing.xxl,
  },
  inputWrapper: {
    marginBottom: Spacing.m,
  },
  buttonWrapper: {
    marginTop: Spacing.m,
    minHeight: 48,
    justifyContent: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.m,
    borderRadius: Radius.small,
    marginTop: Spacing.xs,
    marginBottom: Spacing.s,
  },
  footerText: {
    marginTop: Spacing.xxl,
    textAlign: 'center',
  }
});
