import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, withSequence, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

interface PINPadProps {
  title: string;
  subtitle?: string;
  onComplete: (pin: string) => void;
  onCancel?: () => void;
  error?: string | null;
  maxLength?: number;
}

export function PINPad({ title, subtitle, onComplete, onCancel, error, maxLength = 6 }: PINPadProps) {
  const colors = useColors();
  const [pin, setPin] = useState('');
  const shakeX = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  useEffect(() => {
    if (error) {
      shakeX.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
      setPin('');
    }
  }, [error]);

  const handleKey = (key: string) => {
    if (key === '⌫') {
      setPin(p => p.slice(0, -1));
      return;
    }
    if (key === '') return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = pin + key;
    setPin(next);
    if (next.length >= maxLength) {
      setTimeout(() => onComplete(next), 100);
    }
  };

  const s = styles(colors);

  return (
    <View style={s.container}>
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}

      <Animated.View style={[s.dotsRow, shakeStyle]}>
        {Array.from({ length: maxLength }).map((_, i) => (
          <View key={i} style={[s.dot, i < pin.length && s.dotFilled]} />
        ))}
      </Animated.View>

      {error ? <Text style={s.errorText}>{error}</Text> : null}

      <View style={s.grid}>
        {KEYS.map((key, i) => (
          <TouchableOpacity
            key={i}
            style={[s.key, key === '' && s.keyHidden]}
            onPress={() => handleKey(key)}
            activeOpacity={key === '' ? 1 : 0.6}
            disabled={key === ''}
          >
            {key === '⌫' ? (
              <Ionicons name="backspace-outline" size={24} color={colors.foreground} />
            ) : (
              <Text style={s.keyText}>{key}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {onCancel && (
        <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
          <Text style={s.cancelText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: 32 },
  title: { fontSize: 22, fontWeight: '700', color: colors.foreground, marginBottom: 6, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 14, color: colors.mutedForeground, marginBottom: 32, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  dotsRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.primary, backgroundColor: 'transparent' },
  dotFilled: { backgroundColor: colors.primary },
  errorText: { color: colors.destructive, fontSize: 13, marginBottom: 8, fontFamily: 'Inter_500Medium' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: 264, marginTop: 24 },
  key: { width: 88, height: 72, alignItems: 'center', justifyContent: 'center' },
  keyHidden: { opacity: 0 },
  keyText: { fontSize: 28, fontWeight: '400', color: colors.foreground, fontFamily: 'Inter_400Regular' },
  cancelBtn: { marginTop: 24 },
  cancelText: { fontSize: 15, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
});
