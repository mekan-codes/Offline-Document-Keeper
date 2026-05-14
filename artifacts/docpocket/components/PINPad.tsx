import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';

type PINKey =
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '0'
  | ''
  | 'backspace';

const KEYS: PINKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace'];

interface PINPadProps {
  title: string;
  subtitle?: string;
  onComplete: (pin: string) => void | Promise<unknown>;
  onCancel?: () => void;
  error?: string | null;
  maxLength?: number;
  disabled?: boolean;
}

export function PINPad({
  title,
  subtitle,
  onComplete,
  onCancel,
  error,
  maxLength = 6,
  disabled = false,
}: PINPadProps) {
  const colors = useColors();
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setPin('');
    setSubmitting(false);
  }, [title, subtitle, maxLength]);

  useEffect(() => {
    if (error) {
      setPin('');
      setSubmitting(false);
    }
  }, [error]);

  const handleKey = (key: PINKey) => {
    if (disabled || submitting) return;

    if (key === 'backspace') {
      if (Platform.OS !== 'web') {
        void Haptics.selectionAsync();
      }
      setPin((current) => current.slice(0, -1));
      return;
    }

    if (key === '') return;

    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setPin((current) => {
      if (current.length >= maxLength) return current;

      const next = `${current}${key}`.slice(0, maxLength);
      if (next.length === maxLength) {
        setSubmitting(true);
        setTimeout(() => {
          Promise.resolve(onComplete(next))
            .catch(() => {})
            .finally(() => {
              if (mountedRef.current) setSubmitting(false);
            });
        }, 80);
      }

      return next;
    });
  };

  const s = styles(colors);

  return (
    <View style={s.container}>
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}

      <View style={s.dotsRow}>
        {Array.from({ length: maxLength }).map((_, i) => (
          <View key={i} style={[s.dot, i < pin.length && s.dotFilled]} />
        ))}
      </View>

      {error ? <Text style={s.errorText}>{error}</Text> : null}

      <View style={s.grid}>
        {KEYS.map((key, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [
              s.key,
              key === '' && s.keyHidden,
              key !== '' && pressed && s.keyPressed,
              (disabled || submitting) && key !== 'backspace' && s.keyDisabled,
            ]}
            onPress={() => handleKey(key)}
            disabled={key === '' || disabled}
            hitSlop={6}
          >
            {key === 'backspace' ? (
              <Ionicons name="backspace-outline" size={24} color={colors.foreground} />
            ) : (
              <Text style={s.keyText}>{key}</Text>
            )}
          </Pressable>
        ))}
      </View>

      {onCancel && (
        <Pressable style={s.cancelBtn} onPress={onCancel} hitSlop={10}>
          <Text style={s.cancelText}>Cancel</Text>
        </Pressable>
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
  key: { width: 88, height: 72, alignItems: 'center', justifyContent: 'center', borderRadius: 36 },
  keyPressed: { backgroundColor: colors.muted },
  keyDisabled: { opacity: 0.6 },
  keyHidden: { opacity: 0 },
  keyText: { fontSize: 28, fontWeight: '400', color: colors.foreground, fontFamily: 'Inter_400Regular' },
  cancelBtn: { marginTop: 24 },
  cancelText: { fontSize: 15, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
});
