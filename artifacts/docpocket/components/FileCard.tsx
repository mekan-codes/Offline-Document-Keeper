import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { FILE_CATEGORY_CONFIG, EXPIRY_STATUS, getExpiryStatus } from '@/constants/categories';
import { useSettings } from '@/contexts/SettingsContext';
import type { DocumentFile } from '@/types';

interface FileCardProps {
  file: DocumentFile;
  onPress: () => void;
  onShare: () => void;
  onFavorite: () => void;
}

export function FileCard({ file, onPress, onShare, onFavorite }: FileCardProps) {
  const colors = useColors();
  const { settings } = useSettings();
  const cat = FILE_CATEGORY_CONFIG[file.category];
  const expiryStatus = getExpiryStatus(file.expiryDate, settings.expiryWarningDays);
  const expiry = expiryStatus ? EXPIRY_STATUS[expiryStatus] : null;
  const isPdf = file.mimeType?.includes('pdf');
  const isImage = file.mimeType?.startsWith('image/');

  const s = styles(colors, colors.radius);

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      <View style={[s.iconWrap, { backgroundColor: cat.color + '20' }]}>
        <Ionicons
          name={isPdf ? 'document-text' : isImage ? 'image' : cat.icon as any}
          size={26}
          color={cat.color}
        />
        {file.isSensitive && (
          <View style={s.lockBadge}>
            <Ionicons name="lock-closed" size={9} color="#fff" />
          </View>
        )}
      </View>

      <View style={s.body}>
        <View style={s.nameRow}>
          <Text style={s.name} numberOfLines={1}>{file.name}</Text>
          {file.isSensitive && (
            <Ionicons name="shield-checkmark" size={13} color={colors.primary} style={{ marginLeft: 4 }} />
          )}
        </View>
        <View style={s.meta}>
          <View style={[s.catBadge, { backgroundColor: cat.color + '18' }]}>
            <Text style={[s.catText, { color: cat.color }]}>{cat.label}</Text>
          </View>
          <Text style={s.typeBadge}>{isPdf ? 'PDF' : isImage ? 'Image' : 'File'}</Text>
          {expiry && (
            <View style={[s.expiryBadge, { backgroundColor: expiry.color + '20' }]}>
              <Text style={[s.expiryText, { color: expiry.color }]}>{expiry.label}</Text>
            </View>
          )}
        </View>
        <Text style={s.date}>{new Date(file.updatedAt).toLocaleDateString()}</Text>
      </View>

      <View style={s.actions}>
        <TouchableOpacity
          style={s.actionBtn}
          onPress={(e) => {
            e.stopPropagation();
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onFavorite();
          }}
        >
          <Ionicons
            name={file.isFavorite ? 'star' : 'star-outline'}
            size={18}
            color={file.isFavorite ? '#F59E0B' : colors.mutedForeground}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={s.actionBtn}
          onPress={(e) => {
            e.stopPropagation();
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onShare();
          }}
        >
          <Ionicons name="share-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = (colors: ReturnType<typeof useColors>, radius: number) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  iconWrap: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  lockBadge: { position: 'absolute', bottom: 0, right: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  name: { fontSize: 15, fontWeight: '600', color: colors.foreground, fontFamily: 'Inter_600SemiBold', flex: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  catBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  catText: { fontSize: 11, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  typeBadge: { fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  expiryBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  expiryText: { fontSize: 11, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  date: { fontSize: 11, color: colors.mutedForeground, marginTop: 4, fontFamily: 'Inter_400Regular' },
  actions: { gap: 6 },
  actionBtn: { padding: 6 },
});
