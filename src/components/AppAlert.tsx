import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Alert as RNAlert, Animated, TouchableWithoutFeedback } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Typography } from '../constants/Typography';
import { Spacing, Radius } from '../constants/Colors';
import { BlurView } from 'expo-blur';

export type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type AlertConfig = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: any;
};

let globalAlertHandler: ((config: AlertConfig | null) => void) | null = null;

export function AppAlert() {
  const { colors, isDark } = useTheme();
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.95));

  // Set handler outside useEffect so it survives Fast Refresh
  globalAlertHandler = (newConfig) => {
    if (newConfig) {
      setConfig(newConfig);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      closeModal();
    }
  };

  useEffect(() => {
    return () => {
      globalAlertHandler = null;
    };
  }, []);

  const closeModal = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 150,
        useNativeDriver: true,
      })
    ]).start(() => {
      setConfig(null);
      if (callback) callback();
    });
  };

  if (!config) return null;

  const handleButtonPress = (btn: AlertButton) => {
    closeModal(() => {
      if (btn.onPress) btn.onPress();
    });
  };

  // Default button if none provided
  const buttons = config.buttons && config.buttons.length > 0 
    ? config.buttons 
    : [{ text: 'OK', onPress: () => {} }];

  return (
    <Modal transparent visible={!!config} animationType="none">
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={() => config.options?.cancelable !== false && closeModal()}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
          </Animated.View>
        </TouchableWithoutFeedback>

        <Animated.View 
          style={[
            styles.alertContainer, 
            { 
              backgroundColor: colors.surface, 
              borderColor: colors.border,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          {/* Header Icon based on title */}
          <View style={styles.iconContainer}>
            {config.title.toLowerCase().includes('error') || config.title.toLowerCase().includes('gagal') ? (
              <MaterialCommunityIcons name="alert-circle-outline" size={32} color={colors.outOfStock} />
            ) : config.title.toLowerCase().includes('sukses') || config.title.toLowerCase().includes('berhasil') || config.title.toLowerCase().includes('selesai') ? (
              <MaterialCommunityIcons name="check-circle-outline" size={32} color={colors.safe} />
            ) : config.title.toLowerCase().includes('perhatian') || config.title.toLowerCase().includes('konfirmasi') || config.title.toLowerCase().includes('incomplete') ? (
              <MaterialCommunityIcons name="alert-outline" size={32} color={colors.primary} />
            ) : (
              <MaterialCommunityIcons name="information-outline" size={32} color={colors.primary} />
            )}
          </View>

          <View style={styles.contentContainer}>
            <Text style={[Typography.cardTitle, { color: colors.textPrimary, textAlign: 'center', marginBottom: Spacing.s }]}>
              {config.title}
            </Text>
            {config.message && (
              <Text style={[Typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center' }]}>
                {config.message}
              </Text>
            )}
          </View>

          <View style={[styles.buttonContainer, buttons.length > 2 ? styles.buttonContainerVertical : styles.buttonContainerHorizontal]}>
            {buttons.map((btn, index) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              
              let textColor = colors.primary;
              if (isDestructive) textColor = colors.outOfStock;
              if (isCancel) textColor = colors.textSecondary;

              // Use primary button style for the main action if it's horizontal and it's the last button
              const isPrimaryAction = !isCancel && !isDestructive && (index === buttons.length - 1);
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    buttons.length > 2 ? styles.buttonVertical : styles.buttonHorizontal,
                    index > 0 && buttons.length <= 2 && { borderLeftWidth: 1, borderLeftColor: colors.border },
                    index > 0 && buttons.length > 2 && { borderTopWidth: 1, borderTopColor: colors.border },
                    isPrimaryAction && buttons.length <= 2 && { backgroundColor: 'transparent' } // In native alerts, usually just text color varies
                  ]}
                  onPress={() => handleButtonPress(btn)}
                >
                  <Text style={[
                    Typography.bodyLarge, 
                    { 
                      color: textColor,
                      fontWeight: (isPrimaryAction || isDestructive) ? '600' : '400',
                      textAlign: 'center'
                    }
                  ]}>
                    {btn.text || 'OK'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContainer: {
    width: '80%',
    maxWidth: 400,
    borderRadius: Radius.large,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    alignItems: 'center',
    paddingTop: Spacing.l,
  },
  contentContainer: {
    padding: Spacing.l,
    paddingTop: Spacing.m,
  },
  buttonContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)', // fallback if colors.border not available, but we use it below
  },
  buttonContainerHorizontal: {
    flexDirection: 'row',
  },
  buttonContainerVertical: {
    flexDirection: 'column',
  },
  button: {
    paddingVertical: Spacing.m,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonHorizontal: {
    flex: 1,
  },
  buttonVertical: {
    width: '100%',
  }
});

AppAlert.show = (title: string, message?: string, buttons?: AlertButton[], options?: any) => {
  if (globalAlertHandler) {
    globalAlertHandler({ title, message, buttons, options });
  } else {
    RNAlert.alert(title, message, buttons as any, options);
  }
};
