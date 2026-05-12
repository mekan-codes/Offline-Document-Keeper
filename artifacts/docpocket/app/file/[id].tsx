import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Alert, TextInput, ActivityIndicator, Image, Modal, FlatList,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { useColors } from '@/hooks/useColors';
import { useVault } from '@/contexts/VaultContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useKits } from '@/contexts/KitsContext';
import { FILE_CATEGORY_CONFIG, EXPIRY_STATUS, getExpiryStatus } from '@/constants/categories';
import type { FileCategory } from '@/types';

export default function FileDetailScreen() {
  const params = useLocalSearchParams<{ id: string; private?: string }>();
  const { id } = params;
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { files, updateFileById, deleteFileById } = useVault();
  const { settings } = useSettings();
  const { kits, updateKitById, refreshKits } = useKits();
  const file = files.find(f => f.id === id);
  const fromPrivateVault = params.private === '1';

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(file?.name || '');
  const [editNote, setEditNote] = useState(file?.note || '');
  const [editExpiry, setEditExpiry] = useState(file?.expiryDate || '');
  const [editCategory, setEditCategory] = useState<FileCategory>(file?.category || 'other');
  const [editSensitive, setEditSensitive] = useState(file?.isSensitive ?? false);
  const [editFavorite, setEditFavorite] = useState(file?.isFavorite ?? false);
  const [compressing, setCompressing] = useState(false);
  const [showKitModal, setShowKitModal] = useState(false);

  const s = styles(colors, colors.radius);

  if (!file) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={{ color: colors.foreground, textAlign: 'center', marginTop: 40 }}>File not found</Text>
      </View>
    );
  }

  const cat = FILE_CATEGORY_CONFIG[file.category];
  const expiryStatus = getExpiryStatus(file.expiryDate, settings.expiryWarningDays);
  const expiry = expiryStatus ? EXPIRY_STATUS[expiryStatus] : null;
  const isImage = file.mimeType?.startsWith('image/');
  const isPdf = file.mimeType?.includes('pdf');
  const shouldHidePreview = file.isSensitive && settings.privacyMode && !fromPrivateVault;

  const handleStartEditing = () => {
    setEditName(file.name);
    setEditNote(file.note);
    setEditExpiry(file.expiryDate || '');
    setEditCategory(file.category);
    setEditSensitive(file.isSensitive);
    setEditFavorite(file.isFavorite);
    setEditing(true);
  };

  const handleSave = async () => {
    await updateFileById(file.id, {
      name: editName.trim() || file.name,
      note: editNote,
      expiryDate: editExpiry || undefined,
      category: editCategory,
      isSensitive: editSensitive,
      isFavorite: editFavorite,
    });
    setEditing(false);
  };

  const handleShare = async () => {
    if (Platform.OS === 'web') { Alert.alert('Not supported', 'Sharing is not available on web'); return; }
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) { Alert.alert('Not available', 'Sharing is not available on this device'); return; }
      await Sharing.shareAsync(file.localUri, { mimeType: file.mimeType, dialogTitle: file.name });
      await updateFileById(file.id, { lastSharedAt: new Date().toISOString() });
    } catch { Alert.alert('Error', 'Could not share file'); }
  };

  const handleDelete = () => {
    Alert.alert('Delete File', `Delete "${file.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteFileById(file.id);
          await refreshKits();
          router.back();
        }
      },
    ]);
  };

  const handleAddToKit = async (kitId: string) => {
    const target = kits.find(k => k.id === kitId);
    if (!target) return;
    if (target.fileIds.includes(file.id)) {
      Alert.alert('Already Added', `"${file.name}" is already in "${target.name}".`);
      return;
    }
    await updateKitById(target.id, { fileIds: [...target.fileIds, file.id] });
    setShowKitModal(false);
    Alert.alert('Added to Kit', `"${file.name}" was added to "${target.name}".`);
  };

  const handleCompress = async () => {
    if (!isImage) return;
    setCompressing(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        file.localUri,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      const dir = (FileSystem as any).documentDirectory + 'docpocket/';
      const destUri = dir + `compressed_${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: result.uri, to: destUri });
      const info = await FileSystem.getInfoAsync(destUri);
      const newSize = (info.exists && 'size' in info) ? info.size || 0 : 0;
      Alert.alert(
        'Compressed',
        `Original: ${(file.sizeBytes / 1024).toFixed(0)} KB\nCompressed: ${(newSize / 1024).toFixed(0)} KB`,
        [
          { text: 'Keep Original', style: 'cancel', onPress: async () => { try { await FileSystem.deleteAsync(destUri); } catch {} } },
          { text: 'Save Compressed', onPress: async () => { await updateFileById(file.id, { localUri: destUri, mimeType: 'image/jpeg', sizeBytes: newSize }); } },
        ]
      );
    } catch {
      Alert.alert('Error', 'Failed to compress image');
    } finally { setCompressing(false); }
  };

  const CATEGORIES: FileCategory[] = ['identity', 'visa', 'travel', 'school', 'medical', 'photos', 'other'];

  const ToggleRow = ({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) => (
    <TouchableOpacity style={s.toggleRow} onPress={onToggle} activeOpacity={0.7}>
      <Text style={s.toggleLabel}>{label}</Text>
      <View style={[s.toggle, { backgroundColor: value ? colors.primary : colors.muted }]}>
        <View style={[s.toggleKnob, { marginLeft: value ? 20 : 2 }]} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          <Text style={s.backText}>Vault</Text>
        </TouchableOpacity>
        <View style={s.topActions}>
          {editing ? (
            <>
              <TouchableOpacity onPress={() => setEditing(false)} style={s.topBtn}>
                <Text style={[s.topBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={s.topBtn}>
                <Text style={[s.topBtnText, { color: colors.primary }]}>Save</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={s.topIconBtn} onPress={handleStartEditing}>
                <Ionicons name="pencil-outline" size={20} color={colors.foreground} />
              </TouchableOpacity>
              <TouchableOpacity style={s.topIconBtn} onPress={handleShare}>
                <Ionicons name="share-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={s.topIconBtn} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={20} color={colors.destructive} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {isImage && shouldHidePreview && (
          <View style={[s.lockedPreview, { backgroundColor: colors.muted }]}>
            <Ionicons name="lock-closed" size={42} color={colors.mutedForeground} />
            <Text style={s.lockedPreviewTitle}>Sensitive Document</Text>
            <Text style={s.lockedPreviewSub}>Open from Private Vault to preview while Privacy Mode is on.</Text>
          </View>
        )}

        {isImage && !shouldHidePreview && (
          <View style={s.previewWrap}>
            <Image source={{ uri: file.localUri }} style={s.preview} resizeMode="contain" />
          </View>
        )}

        {!isImage && (
          <View style={[s.iconPreview, { backgroundColor: cat.color + '15' }]}>
            <Ionicons name={isPdf ? 'document-text' : 'document'} size={64} color={cat.color} />
            <Text style={[s.iconPreviewText, { color: cat.color }]}>{isPdf ? 'PDF' : 'File'}</Text>
          </View>
        )}

        <View style={s.body}>
          {editing ? (
            <>
              <Text style={s.label}>Name</Text>
              <TextInput style={[s.input, { borderColor: colors.border, color: colors.foreground }]} value={editName} onChangeText={setEditName} />

              <Text style={s.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
                {CATEGORIES.map(c => {
                  const cfg = FILE_CATEGORY_CONFIG[c];
                  const active = editCategory === c;
                  return (
                    <TouchableOpacity key={c} style={[s.catChip, { backgroundColor: active ? cfg.color : colors.muted, borderColor: active ? cfg.color : colors.border }]}
                      onPress={() => setEditCategory(c)}>
                      <Text style={[s.catChipText, { color: active ? '#fff' : colors.mutedForeground }]}>{cfg.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={s.label}>Note</Text>
              <TextInput style={[s.input, s.textarea, { borderColor: colors.border, color: colors.foreground }]} value={editNote} onChangeText={setEditNote} multiline />

              <Text style={s.label}>Expiry Date (YYYY-MM-DD)</Text>
              <TextInput style={[s.input, { borderColor: colors.border, color: colors.foreground }]} value={editExpiry} onChangeText={setEditExpiry} placeholder="2027-01-15" placeholderTextColor={colors.mutedForeground} />

              <View style={[s.toggleSection, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <ToggleRow
                  label="Sensitive Document"
                  value={editSensitive}
                  onToggle={() => setEditSensitive(v => !v)}
                />
                <View style={[s.divider, { backgroundColor: colors.border }]} />
                <ToggleRow
                  label="Favorite"
                  value={editFavorite}
                  onToggle={() => setEditFavorite(v => !v)}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={s.fileName}>{file.name}</Text>

              <View style={s.metaRow}>
                <View style={[s.catBadge, { backgroundColor: cat.color + '18' }]}>
                  <Ionicons name={cat.icon as any} size={12} color={cat.color} />
                  <Text style={[s.catBadgeText, { color: cat.color }]}>{cat.label}</Text>
                </View>
                <Text style={s.metaText}>{file.mimeType?.includes('pdf') ? 'PDF' : file.mimeType?.startsWith('image') ? 'Image' : 'File'}</Text>
                {file.sizeBytes > 0 && <Text style={s.metaText}>{(file.sizeBytes / 1024).toFixed(0)} KB</Text>}
                {expiry && <View style={[s.expiryBadge, { backgroundColor: expiry.color + '20' }]}><Text style={[s.expiryText, { color: expiry.color }]}>{expiry.label}</Text></View>}
                {file.isSensitive && (
                  <View style={[s.sensitiveBadge, { backgroundColor: '#EF444420' }]}>
                    <Ionicons name="lock-closed" size={11} color="#EF4444" />
                    <Text style={[s.sensitiveBadgeText, { color: '#EF4444' }]}>Sensitive</Text>
                  </View>
                )}
                {file.isFavorite && (
                  <Ionicons name="star" size={14} color="#F59E0B" />
                )}
              </View>

              {file.expiryDate && <Text style={[s.metaText, { marginTop: 4 }]}>Expires: {new Date(file.expiryDate).toLocaleDateString()}</Text>}

              {file.note ? (
                <View style={[s.noteBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Text style={s.noteTitle}>Note</Text>
                  <Text style={s.noteText}>{file.note}</Text>
                </View>
              ) : null}

              <View style={s.infoRows}>
                <View style={s.infoRow}>
                  <Text style={s.infoKey}>Original filename</Text>
                  <Text style={s.infoVal} numberOfLines={1}>{file.originalFileName}</Text>
                </View>
                <View style={s.infoRow}>
                  <Text style={s.infoKey}>Added</Text>
                  <Text style={s.infoVal}>{new Date(file.createdAt).toLocaleDateString()}</Text>
                </View>
                {file.lastSharedAt && (
                  <View style={s.infoRow}>
                    <Text style={s.infoKey}>Last shared</Text>
                    <Text style={s.infoVal}>{new Date(file.lastSharedAt).toLocaleDateString()}</Text>
                  </View>
                )}
              </View>

              <View style={s.toolsSection}>
                <Text style={s.toolsTitle}>Actions</Text>
                <TouchableOpacity style={[s.toolBtn, { borderColor: colors.border }]} onPress={() => setShowKitModal(true)}>
                  <Ionicons name="briefcase-outline" size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.toolBtnLabel}>Add to Kit</Text>
                    <Text style={s.toolBtnSub}>Link this file to a visa, school, travel, or custom kit</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </>
          )}

          {isImage && !editing && (
            <View style={s.toolsSection}>
              <Text style={s.toolsTitle}>Image Tools</Text>
              <TouchableOpacity style={[s.toolBtn, { borderColor: colors.border }]} onPress={handleCompress} disabled={compressing}>
                {compressing ? <ActivityIndicator color={colors.primary} size="small" /> : <Ionicons name="resize-outline" size={18} color={colors.primary} />}
                <View style={{ flex: 1 }}>
                  <Text style={s.toolBtnLabel}>Compress & Resize</Text>
                  <Text style={s.toolBtnSub}>Reduce file size for email/visa submissions</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={showKitModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowKitModal(false)}>
        <View style={[s.kitModal, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, backgroundColor: colors.background }]}>
          <View style={s.kitModalHeader}>
            <TouchableOpacity onPress={() => setShowKitModal(false)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={s.kitModalTitle}>Add to Kit</Text>
            <View style={{ width: 24 }} />
          </View>
          <FlatList
            data={kits}
            keyExtractor={kit => kit.id}
            contentContainerStyle={[s.kitList, kits.length === 0 && { flex: 1 }]}
            ListEmptyComponent={
              <View style={s.emptyKitList}>
                <Ionicons name="briefcase-outline" size={42} color={colors.mutedForeground} />
                <Text style={s.emptyKitText}>No kits yet. Create a kit first from the Kits tab.</Text>
              </View>
            }
            renderItem={({ item: kit }) => {
              const alreadyAdded = kit.fileIds.includes(file.id);
              return (
                <TouchableOpacity
                  style={[s.kitRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleAddToKit(kit.id)}
                  activeOpacity={0.7}
                >
                  <View style={[s.kitRowIcon, { backgroundColor: kit.color + '22' }]}>
                    <Ionicons name={kit.icon as any} size={20} color={kit.color} />
                  </View>
                  <Text style={s.kitRowName} numberOfLines={1}>{kit.name}</Text>
                  {alreadyAdded ? (
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  ) : (
                    <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>, radius: number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 15, color: colors.foreground, fontFamily: 'Inter_500Medium' },
  topActions: { flexDirection: 'row', gap: 4 },
  topIconBtn: { padding: 8 },
  topBtn: { padding: 8 },
  topBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  scroll: { flex: 1 },
  previewWrap: { height: 260, backgroundColor: colors.muted, justifyContent: 'center', alignItems: 'center' },
  preview: { width: '100%', height: 260 },
  lockedPreview: { height: 260, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 8 },
  lockedPreviewTitle: { fontSize: 17, fontWeight: '700', color: colors.foreground, fontFamily: 'Inter_700Bold' },
  lockedPreviewSub: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  iconPreview: { height: 180, justifyContent: 'center', alignItems: 'center', gap: 8 },
  iconPreviewText: { fontSize: 16, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  body: { padding: 20 },
  fileName: { fontSize: 22, fontWeight: '700', color: colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  catBadgeText: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  metaText: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  expiryBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  expiryText: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  sensitiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  sensitiveBadgeText: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  noteBox: { borderRadius: radius, borderWidth: 1, padding: 14, marginTop: 16 },
  noteTitle: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  noteText: { fontSize: 14, color: colors.foreground, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  infoRows: { marginTop: 16, gap: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  infoKey: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', flex: 1 },
  infoVal: { fontSize: 13, color: colors.foreground, fontFamily: 'Inter_500Medium', flex: 2, textAlign: 'right' },
  toolsSection: { marginTop: 24 },
  toolsTitle: { fontSize: 13, fontWeight: '700', color: colors.mutedForeground, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius, borderWidth: 1, backgroundColor: colors.card },
  toolBtnLabel: { fontSize: 15, fontWeight: '500', color: colors.foreground, fontFamily: 'Inter_500Medium' },
  toolBtnSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  kitModal: { flex: 1 },
  kitModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  kitModalTitle: { fontSize: 17, fontWeight: '600', color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
  kitList: { padding: 16 },
  emptyKitList: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  emptyKitText: { color: colors.mutedForeground, textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 14 },
  kitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius, borderWidth: 1, marginBottom: 8 },
  kitRowIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kitRowName: { flex: 1, fontSize: 15, color: colors.foreground, fontFamily: 'Inter_500Medium' },
  label: { fontSize: 13, fontWeight: '600', color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1, borderRadius: radius, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: 'Inter_400Regular', backgroundColor: colors.card },
  textarea: { height: 80, paddingTop: 11, textAlignVertical: 'top' },
  catRow: { gap: 8, paddingVertical: 4 },
  catChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  catChipText: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  toggleSection: { marginTop: 20, borderRadius: radius, borderWidth: 1, overflow: 'hidden' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  toggleLabel: { fontSize: 15, color: colors.foreground, fontFamily: 'Inter_500Medium' },
  toggle: { width: 44, height: 24, borderRadius: 12, justifyContent: 'center', flexShrink: 0 },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', elevation: 2 },
  divider: { height: 1, marginLeft: 16 },
});
