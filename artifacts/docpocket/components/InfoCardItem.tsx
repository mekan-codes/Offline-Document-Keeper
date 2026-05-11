import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { INFO_CATEGORY_CONFIG } from '@/constants/categories';
import { useSettings } from '@/contexts/SettingsContext';
import type { InfoCard } from '@/types';

interface InfoCardItemProps {
  card: InfoCard;
  onEdit: () => void;
  onDelete: () => void;
  onFavorite: () => void;
}

function maskValue(value: string): string {
  if (value.length <= 4) return '••••';
  return value.slice(0, 2) + '••••' + value.slice(-2);
}

export function InfoCardItem({ card, onEdit, onDelete, onFavorite }: InfoCardItemProps) {
  const colors = useColors();
  const { settings } = useSettings();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const clipboardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cat = INFO_CATEGORY_CONFIG[card.category];

  const handleCopy = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Clipboard.setStringAsync(card.value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (card.isSensitive && settings.clearClipboardAfterSeconds > 0) {
      if (clipboardTimer.current) clearTimeout(clipboardTimer.current);
      clipboardTimer.current = setTimeout(async () => {
        try { await Clipboard.setStringAsync(''); } catch {}
      }, settings.clearClipboardAfterSeconds * 1000);
    }
  };

  const showValue = revealed || !card.isSensitive || !settings.privacyMode;
  const displayValue = showValue ? card.value : maskValue(card.value);

  const s = styles(colors, colors.radius);

  return (
    <View style={s.card}>
      <View style={[s.catDot, { backgroundColor: cat.color }]} />
      <View style={s.body}>
        <View style={s.header}>
          <Text style={s.title} numberOfLines={1}>{card.title}</Text>
          <View style={s.headerActions}>
            {card.isFavorite && <Ionicons name="star" size={14} color="#F59E0B" />}
            <TouchableOpacity onPress={onFavorite}>
              <Ionicons name={card.isFavorite ? 'star' : 'star-outline'} size={16} color={card.isFavorite ? '#F59E0B' : colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.valueRow}>
          <Text style={[s.value, card.isSensitive && settings.privacyMode && !revealed && s.maskedValue]} numberOfLines={1} selectable>
            {displayValue}
          </Text>
          {card.isSensitive && (
            <TouchableOpacity onPress={() => setRevealed(!revealed)} style={s.eyeBtn}>
              <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        <View style={s.footer}>
          <View style={[s.catBadge, { backgroundColor: cat.color + '18' }]}>
            <Text style={[s.catText, { color: cat.color }]}>{cat.label}</Text>
          </View>
          <View style={s.footerActions}>
            <TouchableOpacity style={s.copyBtn} onPress={handleCopy}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={copied ? '#10B981' : colors.primary} />
              <Text style={[s.copyText, { color: copied ? '#10B981' : colors.primary }]}>
                {copied ? 'Copied' : 'Copy'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={onEdit}>
              <Ionicons name="pencil-outline" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={onDelete}>
              <Ionicons name="trash-outline" size={14} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>, radius: number) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius,
    marginHorizontal: 16,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  catDot: { width: 4, flexShrink: 0 },
  body: { flex: 1, padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '600', color: colors.foreground, fontFamily: 'Inter_600SemiBold', flex: 1 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  value: { fontSize: 16, color: colors.foreground, fontFamily: 'Inter_500Medium', flex: 1 },
  maskedValue: { letterSpacing: 3, color: colors.mutedForeground },
  eyeBtn: { padding: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  catText: { fontSize: 11, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.primary + '15' },
  copyText: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  iconBtn: { padding: 6 },
});
