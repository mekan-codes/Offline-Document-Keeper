import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { Kit } from '@/types';
import { useVault } from '@/contexts/VaultContext';
import { useInfo } from '@/contexts/InfoContext';

interface KitCardProps {
  kit: Kit;
  onPress: () => void;
}

export function KitCard({ kit, onPress }: KitCardProps) {
  const colors = useColors();
  const { files } = useVault();
  const { cards } = useInfo();

  const requiredItems = kit.requiredItems || [];
  const total = kit.fileIds.length + kit.infoCardIds.length + kit.checklistItems.length + requiredItems.length;
  const fileReady = kit.fileIds.filter(id => files.find(f => f.id === id)).length;
  const infoReady = kit.infoCardIds.filter(id => cards.find(c => c.id === id)).length;
  const checkDone = kit.checklistItems.filter(i => i.isDone).length;
  const requiredReady = requiredItems.filter(item =>
    item.manuallyDone ||
    (item.linkedFileId && files.some(f => f.id === item.linkedFileId)) ||
    (item.linkedInfoCardId && cards.some(c => c.id === item.linkedInfoCardId))
  ).length;
  const ready = fileReady + infoReady + checkDone + requiredReady;

  const progress = total > 0 ? ready / total : 0;
  const progressColor = progress >= 1 ? '#10B981' : progress >= 0.5 ? '#F59E0B' : colors.destructive;

  const s = styles(colors, colors.radius);

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      <View style={[s.iconWrap, { backgroundColor: kit.color + '22' }]}>
        <Ionicons name={kit.icon as any} size={26} color={kit.color} />
      </View>
      <View style={s.body}>
        <Text style={s.name} numberOfLines={1}>{kit.name}</Text>
        <View style={s.progressRow}>
          <View style={s.progressBg}>
            <View style={[s.progressFill, { width: `${progress * 100}%` as any, backgroundColor: progressColor }]} />
          </View>
          <Text style={[s.progressText, { color: progressColor }]}>{ready}/{total} ready</Text>
        </View>
        <Text style={s.date}>Updated {new Date(kit.updatedAt).toLocaleDateString()}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

const styles = (colors: ReturnType<typeof useColors>, radius: number) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  iconWrap: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  progressBg: { flex: 1, height: 4, backgroundColor: colors.muted, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  progressText: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold', minWidth: 60, textAlign: 'right' },
  date: { fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
});
