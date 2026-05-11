import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Alert, TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useKits } from '@/contexts/KitsContext';
import { useVault } from '@/contexts/VaultContext';
import { useInfo } from '@/contexts/InfoContext';
import { useSettings } from '@/contexts/SettingsContext';
import { FILE_CATEGORY_CONFIG, INFO_CATEGORY_CONFIG } from '@/constants/categories';
import { makeChecklistItem } from '@/storage/db';

export default function KitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { kits, updateKitById, deleteKitById, toggleChecklistItem } = useKits();
  const { files } = useVault();
  const { cards } = useInfo();
  const { settings } = useSettings();

  const kit = kits.find(k => k.id === id);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [showAddCheck, setShowAddCheck] = useState(false);
  const [editingRequirements, setEditingRequirements] = useState(false);
  const [reqNote, setReqNote] = useState(kit?.requirementsNote || '');

  if (!kit) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.foreground }}>Kit not found</Text>
      </View>
    );
  }

  const kitFiles = kit.fileIds.map(fid => files.find(f => f.id === fid)).filter(Boolean) as typeof files;
  const kitCards = kit.infoCardIds.map(cid => cards.find(c => c.id === cid)).filter(Boolean) as typeof cards;

  const total = kit.fileIds.length + kit.infoCardIds.length + kit.checklistItems.length;
  const fileReady = kitFiles.length;
  const infoReady = kitCards.length;
  const checkDone = kit.checklistItems.filter(i => i.isDone).length;
  const ready = fileReady + infoReady + checkDone;
  const progress = total > 0 ? ready / total : 0;
  const progressColor = progress >= 1 ? '#10B981' : progress >= 0.5 ? '#F59E0B' : colors.destructive;

  const handleShareAll = async () => {
    if (Platform.OS === 'web') { Alert.alert('Not supported', 'Sharing not available on web'); return; }
    if (kitFiles.length === 0) { Alert.alert('No files', 'Add files to this kit first'); return; }
    for (const f of kitFiles) {
      try {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) await Sharing.shareAsync(f.localUri, { mimeType: f.mimeType, dialogTitle: f.name });
        await new Promise(r => setTimeout(r, 500));
      } catch {}
    }
  };

  const handleShareFile = async (uri: string, mimeType: string, name: string) => {
    if (Platform.OS === 'web') { Alert.alert('Not supported'); return; }
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(uri, { mimeType, dialogTitle: name });
    } catch {}
  };

  const handleCopyInfo = async (value: string, isSensitive: boolean) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Clipboard.setStringAsync(value);
    if (isSensitive && settings.clearClipboardAfterSeconds > 0) {
      setTimeout(async () => { try { await Clipboard.setStringAsync(''); } catch {} }, settings.clearClipboardAfterSeconds * 1000);
    }
  };

  const handleAddChecklist = async () => {
    if (!newCheckItem.trim()) return;
    const item = makeChecklistItem(newCheckItem.trim());
    await updateKitById(kit.id, { checklistItems: [...kit.checklistItems, item] });
    setNewCheckItem('');
    setShowAddCheck(false);
  };

  const handleDeleteChecklist = async (itemId: string) => {
    await updateKitById(kit.id, { checklistItems: kit.checklistItems.filter(i => i.id !== itemId) });
  };

  const handleDelete = () => {
    Alert.alert('Delete Kit', `Delete "${kit.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteKitById(kit.id); router.back(); } },
    ]);
  };

  const s = styles(colors, colors.radius);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          <Text style={s.backText}>Kits</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete}>
          <Ionicons name="trash-outline" size={20} color={colors.destructive} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Kit header */}
        <View style={[s.kitHeader, { backgroundColor: kit.color + '18' }]}>
          <View style={[s.kitIconWrap, { backgroundColor: kit.color + '30' }]}>
            <Ionicons name={kit.icon as any} size={32} color={kit.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.kitName}>{kit.name}</Text>
            <View style={s.progressRow}>
              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${progress * 100}%` as any, backgroundColor: progressColor }]} />
              </View>
              <Text style={[s.progressText, { color: progressColor }]}>{ready}/{total} ready</Text>
            </View>
          </View>
        </View>

        {/* Share all */}
        {kitFiles.length > 0 && (
          <View style={s.section}>
            <TouchableOpacity style={[s.shareAllBtn, { backgroundColor: colors.primary }]} onPress={handleShareAll}>
              <Ionicons name="share-outline" size={18} color="#fff" />
              <Text style={s.shareAllText}>Share All Files ({kitFiles.length})</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Files */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Files</Text>
          {kitFiles.length === 0 ? (
            <Text style={s.emptyText}>No files added yet</Text>
          ) : kitFiles.map(f => {
            const cat = FILE_CATEGORY_CONFIG[f.category];
            return (
              <View key={f.id} style={[s.itemRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[s.itemIcon, { backgroundColor: cat.color + '20' }]}>
                  <Ionicons name={f.mimeType?.startsWith('image') ? 'image' : 'document-text'} size={20} color={cat.color} />
                </View>
                <Text style={s.itemLabel} numberOfLines={1}>{f.name}</Text>
                <TouchableOpacity style={s.itemAction} onPress={() => handleShareFile(f.localUri, f.mimeType, f.name)}>
                  <Ionicons name="share-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Info</Text>
          {kitCards.length === 0 ? (
            <Text style={s.emptyText}>No info cards added yet</Text>
          ) : kitCards.map(c => {
            const cat = INFO_CATEGORY_CONFIG[c.category];
            return (
              <View key={c.id} style={[s.itemRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[s.itemDot, { backgroundColor: cat.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.itemLabel} numberOfLines={1}>{c.title}</Text>
                  <Text style={[s.itemSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {settings.privacyMode && c.isSensitive ? '••••••' : c.value}
                  </Text>
                </View>
                <TouchableOpacity style={s.itemAction} onPress={() => handleCopyInfo(c.value, c.isSensitive)}>
                  <Ionicons name="copy-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Checklist */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Checklist</Text>
            <Text style={[s.sectionCount, { color: progressColor }]}>{checkDone}/{kit.checklistItems.length}</Text>
          </View>
          {kit.checklistItems.map(item => (
            <TouchableOpacity key={item.id} style={[s.checkRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => toggleChecklistItem(kit.id, item.id)} activeOpacity={0.7}>
              <View style={[s.checkBox, { borderColor: item.isDone ? '#10B981' : colors.border, backgroundColor: item.isDone ? '#10B981' : 'transparent' }]}>
                {item.isDone && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={[s.checkText, item.isDone && s.checkTextDone]}>{item.text}</Text>
              <TouchableOpacity onPress={() => handleDeleteChecklist(item.id)} style={{ padding: 4 }}>
                <Ionicons name="close" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}

          {showAddCheck ? (
            <View style={[s.addCheckRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput style={[s.checkInput, { color: colors.foreground }]} value={newCheckItem} onChangeText={setNewCheckItem}
                placeholder="New checklist item" placeholderTextColor={colors.mutedForeground} autoFocus returnKeyType="done" onSubmitEditing={handleAddChecklist} />
              <TouchableOpacity onPress={handleAddChecklist}>
                <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowAddCheck(false); setNewCheckItem(''); }}>
                <Ionicons name="close-circle" size={24} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={s.addBtn} onPress={() => setShowAddCheck(true)}>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={[s.addBtnText, { color: colors.primary }]}>Add item</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Requirements */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Requirements</Text>
            <TouchableOpacity onPress={() => { setReqNote(kit.requirementsNote); setEditingRequirements(!editingRequirements); }}>
              <Ionicons name={editingRequirements ? 'checkmark-circle' : 'pencil-outline'} size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {editingRequirements ? (
            <TextInput
              style={[s.reqInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              value={reqNote} onChangeText={setReqNote} multiline placeholder="Add requirements, rules, deadlines..."
              placeholderTextColor={colors.mutedForeground} textAlignVertical="top"
              onBlur={async () => { await updateKitById(kit.id, { requirementsNote: reqNote }); setEditingRequirements(false); }}
            />
          ) : (
            <Text style={[s.reqText, { color: kit.requirementsNote ? colors.foreground : colors.mutedForeground }]}>
              {kit.requirementsNote || 'No requirements added. Tap edit to add photo sizes, file limits, etc.'}
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>, radius: number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 15, color: colors.foreground, fontFamily: 'Inter_500Medium' },
  kitHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20 },
  kitIconWrap: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  kitName: { fontSize: 22, fontWeight: '700', color: colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 10 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBg: { flex: 1, height: 6, backgroundColor: colors.muted, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  progressText: { fontSize: 13, fontWeight: '700', fontFamily: 'Inter_700Bold', minWidth: 60, textAlign: 'right' },
  shareAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: radius },
  shareAllText: { color: '#fff', fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  section: { marginHorizontal: 16, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.mutedForeground, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  sectionCount: { fontSize: 13, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  emptyText: { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 14, fontStyle: 'italic' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius, borderWidth: 1, marginBottom: 6 },
  itemIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemDot: { width: 10, height: 10, borderRadius: 5 },
  itemLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.foreground, fontFamily: 'Inter_500Medium' },
  itemSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  itemAction: { padding: 6 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius, borderWidth: 1, marginBottom: 6 },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkText: { flex: 1, fontSize: 14, color: colors.foreground, fontFamily: 'Inter_400Regular' },
  checkTextDone: { textDecorationLine: 'line-through', color: colors.mutedForeground },
  addCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius, borderWidth: 1, marginBottom: 6 },
  checkInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', paddingVertical: 0 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  addBtnText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  reqInput: { borderWidth: 1, borderRadius: radius, padding: 14, fontSize: 14, fontFamily: 'Inter_400Regular', minHeight: 100 },
  reqText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 21 },
});
