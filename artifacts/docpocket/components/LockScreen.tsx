import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAppLock } from '@/contexts/AppLockContext';
import { PINPad } from './PINPad';

export function LockScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { unlockWithPin, unlockWithBiometrics, hasBiometrics, pinError, clearPinError } = useAppLock();

  useEffect(() => {
    if (hasBiometrics) {
      unlockWithBiometrics();
    }
  }, []);

  const s = styles(colors);

  return (
    <View style={[s.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.logoArea}>
        <View style={s.logoCircle}>
          <Ionicons name="shield-checkmark" size={40} color={colors.primary} />
        </View>
        <Text style={s.appName}>DocPocket</Text>
        <Text style={s.tagline}>Your private document vault</Text>
      </View>

      <PINPad
        title="Enter PIN"
        subtitle="Enter your PIN to unlock"
        onComplete={unlockWithPin}
        error={pinError}
      />

      {hasBiometrics && Platform.OS !== 'web' && (
        <TouchableOpacity style={s.biometricBtn} onPress={unlockWithBiometrics}>
          <Ionicons name="finger-print" size={32} color={colors.primary} />
          <Text style={s.biometricText}>Use Biometrics</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    alignItems: 'center',
    zIndex: 9999,
  },
  logoArea: { alignItems: 'center', marginBottom: 40 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  appName: { fontSize: 26, fontWeight: '700', color: colors.foreground, fontFamily: 'Inter_700Bold' },
  tagline: { fontSize: 14, color: colors.mutedForeground, marginTop: 4, fontFamily: 'Inter_400Regular' },
  biometricBtn: { marginTop: 32, alignItems: 'center', gap: 8 },
  biometricText: { fontSize: 14, color: colors.primary, fontFamily: 'Inter_500Medium' },
});
