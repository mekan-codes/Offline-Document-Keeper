import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Alert, TextInput, Modal, FlatList,
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
import { SelectFilesModal } from '@/components/SelectFilesModal';
import { SelectInfoModal } from '@/components/SelectInfoModal';
import type { RequiredItem } from '@/types';

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
  const [editingReq, setEditingReq] = useState(false);
  const [reqNote, setReqNote] = useState(kit?.requirementsNote || '');
  const [showSelectFiles, setShowSelectFiles] = useState(false);
  const [showSelectInfo, setShowSelectInfo] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareSelectedIds, setShareSelectedIds] = useState<string[]>([]);
  const [showLinkFileForReqId, setShowLinkFileForReqId] = useState<string | null>(null);

  useEffect(() => {
    if (!editingReq) setReqNote(kit?.requirementsNote || '');
  }, [kit?.id, kit?.requirementsNote, editingReq]);

  if (!kit) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.foreground }}>Kit not found</Text>
      </View>
    );
  }

  const kitFiles = kit.fileIds.map(fid => files.find(f => f.id === fid)).filter(Boolean) as typeof files;
  const kitCards = kit.infoCardIds.map(cid => cards.find(c => c.id === cid)).filter(Boolean) as typeof cards;
  const requiredItems = kit.requiredItems || [];

  const isRequiredItemSatisfied = (ri: RequiredItem): boolean => {
    if (ri.manuallyDone) return true;
    if (ri.linkedFileId && files.find(f => f.id === ri.linkedFileId)) return true;
    if (ri.linkedInfoCardId && cards.find(c => c.id === ri.linkedInfoCardId)) return true;
    return false;
  };

  const satisfiedRequiredCount = requiredItems.filter(ri => isRequiredItemSatisfied(ri)).length;
  const missingItems = requiredItems.filter(ri => !isRequiredItemSatisfied(ri));

  const totalItems = kit.fileIds.length + kit.infoCardIds.length + kit.checklistItems.length + requiredItems.length;
  const doneItems = kitFiles.length + kitCards.length + kit.checklistItems.filter(i => i.isDone).length + satisfiedRequiredCount;
  const progress = totalItems > 0 ? doneItems / totalItems : 0;
  const progressColor = progress >= 1 ? '#10B981' : progress >= 0.5 ? '#F59E0B' : colors.destructive;

  const handleAddFiles = async (selectedIds: string[]) => {
    const merged = Array.from(new Set([...kit.fileIds, ...selectedIds]));
    await updateKitById(kit.id, { fileIds: merged });
  };

  const handleAddInfo = async (selectedIds: string[]) => {
    const merged = Array.from(new Set([...kit.infoCardIds, ...selectedIds]));
    await updateKitById(kit.id, { infoCardIds: merged });
  };

  const handleRemoveFile = (fileId: string) => {
    Alert.alert('Remove from Kit', 'Remove this file from the kit? The original file will remain in your Vault.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await updateKitById(kit.id, { fileIds: kit.fileIds.filter(fid => fid !== fileId) });
      }},
    ]);
  };

  const handleRemoveInfo = (cardId: string) => {
    Alert.alert('Remove from Kit', 'Remove this info card from the kit? The original card will remain in your Info tab.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await updateKitById(kit.id, { infoCardIds: kit.infoCardIds.filter(cid => cid !== cardId) });
      }},
    ]);
  };

  const handleShareFile = async (uri: string, mimeType: string, name: string) => {
    if (Platform.OS === 'web') return;
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(uri, { mimeType, dialogTitle: name });
    } catch {}
  };

  const handleSharePackage = () => {
    if (kitFiles.length === 0) { Alert.alert('No files', 'Add files to this kit first before sharing.'); return; }
    setShareSelectedIds(kitFiles.map(f => f.id));
    setShowShareModal(true);
  };

  const handleShareSelected = async () => {
    const toShare = kitFiles.filter(f => shareSelectedIds.includes(f.id));
    if (toShare.length === 0) { Alert.alert('None selected', 'Select at least one file to share.'); return; }
    if (Platform.OS === 'web') { Alert.alert('Not supported', 'Sharing is not available on web.'); return; }

    if (toShare.length > 1) {
      Alert.alert(
        'Share Files One by One',
        `Android may open the share sheet one file at a time. ${toShare.length} share sheets may open.\n\nContinue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Share All', onPress: async () => {
            setShowShareModal(false);
            for (const f of toShare) {
              try {
                const canShare = await Sharing.isAvailableAsync();
                if (canShare) await Sharing.shareAsync(f.localUri, { mimeType: f.mimeType, dialogTitle: f.name });
                await new Promise(r => setTimeout(r, 700));
              } catch {}
            }
          }},
        ]
      );
    } else {
      setShowShareModal(false);
      try {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) await Sharing.shareAsync(toShare[0].localUri, { mimeType: toShare[0].mimeType, dialogTitle: toShare[0].name });
      } catch {}
    }
  };

  const toggleShareSelect = (fileId: string) => {
    setShareSelectedIds(prev =>
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
    );
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

  const handleDeleteKit = () => {
    Alert.alert('Delete Kit', `Delete "${kit.name}"? All files and info cards will remain in your Vault.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Kit', style: 'destructive', onPress: async () => { await deleteKitById(kit.id); router.back(); } },
    ]);
  };

  const handleToggleRequiredItem = async (reqId: string) => {
    const updated = requiredItems.map(ri =>
      ri.id === reqId
        ? { ...ri, manuallyDone: !isRequiredItemSatisfied(ri), linkedFileId: undefined, linkedInfoCardId: undefined }
        : ri
    );
    await updateKitById(kit.id, { requiredItems: updated });
  };

  const handleLinkFileToRequired = async (reqId: string, fileId: string) => {
    const updated = requiredItems.map(ri =>
      ri.id === reqId ? { ...ri, linkedFileId: fileId, manuallyDone: false } : ri
    );
    await updateKitById(kit.id, { requiredItems: updated, fileIds: Array.from(new Set([...kit.fileIds, fileId])) });
    setShowLinkFileForReqId(null);
  };

  const handleUnlinkRequired = async (reqId: string) => {
    const updated = requiredItems.map(ri =>
      ri.id === reqId ? { ...ri, linkedFileId: undefined, linkedInfoCardId: undefined, manuallyDone: false } : ri
    );
    await updateKitById(kit.id, { requiredItems: updated });
  };

  const s = styles(colors, colors.radius);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          <Text style={s.backText}>Kits</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDeleteKit}>
          <Ionicons name="trash-outline" size={20} color={colors.destructive} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={[s.kitHeader, { backgroundColor: kit.color + '15' }]}>
          <View style={[s.kitIconWrap, { backgroundColor: kit.color + '30' }]}>
            <Ionicons name={kit.icon as any} size={32} color={kit.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.kitName}>{kit.name}</Text>
            <View style={s.progressRow}>
              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${progress * 100}%` as any, backgroundColor: progressColor }]} />
              </View>
              <Text style={[s.progressText, { color: progressColor }]}>{doneItems}/{totalItems} ready</Text>
            </View>
          </View>
        </View>

        {requiredItems.length > 0 && (
          <View style={[s.missingBanner, { backgroundColor: missingItems.length > 0 ? '#EF444412' : '#10B98112', borderColor: missingItems.length > 0 ? '#EF444430' : '#10B98130' }]}>
            <Ionicons name={missingItems.length > 0 ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={16} color={missingItems.length > 0 ? '#EF4444' : '#10B981'} />
            <View style={{ flex: 1 }}>
              <Text style={[s.missingTitle, { color: missingItems.length > 0 ? '#EF4444' : '#10B981' }]}>
                {missingItems.length > 0 ? 'Missing:' : 'All required items ready'}
              </Text>
              {missingItems.map(ri => (
                <Text key={ri.id} style={s.missingItem}>• {ri.label}</Text>
              ))}
            </View>
          </View>
        )}

        {kitFiles.length > 0 && (
          <View style={s.section}>
            <TouchableOpacity style={[s.shareAllBtn, { backgroundColor: colors.primary }]} onPress={handleSharePackage}>
              <Ionicons name="share-outline" size={18} color="#fff" />
              <Text style={s.shareAllText}>Share Package</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Files ({kit.fileIds.length})</Text>
            <TouchableOpacity style={[s.addItemBtn, { borderColor: colors.primary }]} onPress={() => setShowSelectFiles(true)}>
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={[s.addItemText, { color: colors.primary }]}>Add File</Text>
            </TouchableOpacity>
          </View>
          {kitFiles.length === 0 ? (
            <Text style={s.emptyText}>Tap "Add File" to link files from your Vault</Text>
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
                <TouchableOpacity style={s.itemAction} onPress={() => handleRemoveFile(f.id)}>
                  <Ionicons name="close-circle" size={18} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Info ({kit.infoCardIds.length})</Text>
            <TouchableOpacity style={[s.addItemBtn, { borderColor: colors.primary }]} onPress={() => setShowSelectInfo(true)}>
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={[s.addItemText, { color: colors.primary }]}>Add Info</Text>
            </TouchableOpacity>
          </View>
          {kitCards.length === 0 ? (
            <Text style={s.emptyText}>Tap "Add Info" to link info cards</Text>
          ) : kitCards.map(c => {
            const cat = INFO_CATEGORY_CONFIG[c.category];
            return (
              <View key={c.id} style={[s.itemRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[s.catDot, { backgroundColor: cat.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.itemLabel} numberOfLines={1}>{c.title}</Text>
                  <Text style={[s.itemSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {settings.privacyMode && c.isSensitive ? '••••••' : c.value}
                  </Text>
                </View>
                <TouchableOpacity style={s.itemAction} onPress={() => handleCopyInfo(c.value, c.isSensitive)}>
                  <Ionicons name="copy-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={s.itemAction} onPress={() => handleRemoveInfo(c.id)}>
                  <Ionicons name="close-circle" size={18} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {requiredItems.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Required Items ({satisfiedRequiredCount}/{requiredItems.length})</Text>
            </View>
            {requiredItems.map(ri => {
              const satisfied = isRequiredItemSatisfied(ri);
              const linkedFile = ri.linkedFileId ? files.find(f => f.id === ri.linkedFileId) : null;
              return (
                <View key={ri.id} style={[s.reqItemRow, { backgroundColor: colors.card, borderColor: satisfied ? '#10B98130' : colors.border }]}>
                  <TouchableOpacity onPress={() => handleToggleRequiredItem(ri.id)} style={[s.reqCheckBox, { borderColor: satisfied ? '#10B981' : colors.border, backgroundColor: satisfied ? '#10B981' : 'transparent' }]}>
                    {satisfied && <Ionicons name="checkmark" size={13} color="#fff" />}
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.reqItemLabel, satisfied && s.reqItemLabelDone]}>{ri.label}</Text>
                    {linkedFile && <Text style={[s.reqItemSub, { color: colors.primary }]} numberOfLines={1}>Linked: {linkedFile.name}</Text>}
                    {!satisfied && !linkedFile && (
                      <TouchableOpacity onPress={() => setShowLinkFileForReqId(ri.id)}>
                        <Text style={[s.reqItemSub, { color: colors.primary }]}>Tap to link a file</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {linkedFile && (
                    <TouchableOpacity style={s.itemAction} onPress={() => handleUnlinkRequired(ri.id)}>
                      <Ionicons name="unlink-outline" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  )}
                  {!linkedFile && !ri.manuallyDone && (
                    <TouchableOpacity style={s.itemAction} onPress={() => setShowLinkFileForReqId(ri.id)}>
                      <Ionicons name="link-outline" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Checklist</Text>
            <Text style={[s.sectionCount, { color: progressColor }]}>
              {kit.checklistItems.filter(i => i.isDone).length}/{kit.checklistItems.length} done
            </Text>
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
              <TextInput style={[s.checkInput, { color: colors.foreground }]} value={newCheckItem}
                onChangeText={setNewCheckItem} placeholder="New checklist item"
                placeholderTextColor={colors.mutedForeground} autoFocus returnKeyType="done"
                onSubmitEditing={handleAddChecklist} />
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

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Requirements</Text>
            {!editingReq && (
              <TouchableOpacity style={[s.reqEditBtn, { borderColor: colors.primary }]} onPress={() => { setReqNote(kit.requirementsNote || ''); setEditingReq(true); }}>
                <Text style={[s.reqEditText, { color: colors.primary }]}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
          {editingReq ? (
            <>
              <TextInput
                style={[s.reqInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                value={reqNote} onChangeText={setReqNote} multiline
                placeholder="Add requirements: photo size, file format, deadlines..."
                placeholderTextColor={colors.mutedForeground} textAlignVertical="top"
              />
              <View style={s.reqActions}>
                <TouchableOpacity style={[s.reqActionBtn, { borderColor: colors.border }]} onPress={() => { setReqNote(kit.requirementsNote || ''); setEditingReq(false); }}>
                  <Text style={[s.reqActionText, { color: colors.mutedForeground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.reqActionBtn, { borderColor: colors.primary, backgroundColor: colors.primary }]} onPress={async () => { await updateKitById(kit.id, { requirementsNote: reqNote }); setEditingReq(false); }}>
                  <Text style={[s.reqActionText, { color: '#fff' }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={[s.reqText, { color: kit.requirementsNote ? colors.foreground : colors.mutedForeground }]}>
              {kit.requirementsNote || 'No requirements added. Tap edit to add photo sizes, deadlines, format rules.'}
            </Text>
          )}
        </View>
      </ScrollView>

      <SelectFilesModal
        visible={showSelectFiles}
        onClose={() => setShowSelectFiles(false)}
        existingFileIds={kit.fileIds}
        onConfirm={handleAddFiles}
      />
      <SelectInfoModal
        visible={showSelectInfo}
        onClose={() => setShowSelectInfo(false)}
        existingCardIds={kit.infoCardIds}
        onConfirm={handleAddInfo}
      />

      <Modal visible={showShareModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowShareModal(false)}>
        <View style={[s.shareModal, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, backgroundColor: colors.background }]}>
          <View style={s.shareModalHeader}>
            <TouchableOpacity onPress={() => setShowShareModal(false)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={s.shareModalTitle}>Share Package</Text>
            <TouchableOpacity onPress={handleShareSelected}>
              <Text style={[s.shareConfirmBtn, { color: colors.primary }]}>Share ({shareSelectedIds.length})</Text>
            </TouchableOpacity>
          </View>
          <Text style={[s.shareModalSub, { color: colors.mutedForeground }]}>
            Select files to share. Android may open the share sheet one file at a time.
          </Text>
          <FlatList
            data={kitFiles}
            keyExtractor={f => f.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
            renderItem={({ item: f }) => {
              const cat = FILE_CATEGORY_CONFIG[f.category];
              const selected = shareSelectedIds.includes(f.id);
              return (
                <TouchableOpacity
                  style={[s.shareFileRow, { backgroundColor: selected ? colors.primary + '12' : colors.card, borderColor: selected ? colors.primary : colors.border }]}
                  onPress={() => toggleShareSelect(f.id)}
                  activeOpacity={0.7}
                >
                  <View style={[s.itemIcon, { backgroundColor: cat.color + '20' }]}>
                    <Ionicons name={f.mimeType?.startsWith('image') ? 'image' : 'document-text'} size={18} color={cat.color} />
                  </View>
                  <Text style={[s.itemLabel, { flex: 1 }]} numberOfLines={1}>{f.name}</Text>
                  <View style={[s.shareCheckBox, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : 'transparent' }]}>
                    {selected && <Ionicons name="checkmark" size={13} color="#fff" />}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>

      <Modal visible={showLinkFileForReqId !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowLinkFileForReqId(null)}>
        <View style={[s.shareModal, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, backgroundColor: colors.background }]}>
          <View style={s.shareModalHeader}>
            <TouchableOpacity onPress={() => setShowLinkFileForReqId(null)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={s.shareModalTitle}>Link a File</Text>
            <View style={{ width: 60 }} />
          </View>
          <Text style={[s.shareModalSub, { color: colors.mutedForeground }]}>
            Select a file from your Vault to link to this required item.
          </Text>
          <FlatList
            data={files}
            keyExtractor={f => f.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
            ListEmptyComponent={<Text style={[s.emptyText, { padding: 20 }]}>No files in Vault yet.</Text>}
            renderItem={({ item: f }) => {
              const cat = FILE_CATEGORY_CONFIG[f.category];
              return (
                <TouchableOpacity
                  style={[s.shareFileRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => showLinkFileForReqId && handleLinkFileToRequired(showLinkFileForReqId, f.id)}
                  activeOpacity={0.7}
                >
                  <View style={[s.itemIcon, { backgroundColor: cat.color + '20' }]}>
                    <Ionicons name={f.mimeType?.startsWith('image') ? 'image' : 'document-text'} size={18} color={cat.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemLabel} numberOfLines={1}>{f.name}</Text>
                    <Text style={[s.itemSub, { color: colors.mutedForeground }]}>{cat.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
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
  missingBanner: { marginHorizontal: 16, marginBottom: 12, borderRadius: radius, borderWidth: 1, padding: 12, flexDirection: 'row', gap: 10 },
  missingTitle: { fontSize: 13, fontWeight: '600', color: '#EF4444', fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  missingItem: { fontSize: 12, color: '#EF4444', fontFamily: 'Inter_400Regular', lineHeight: 18 },
  shareAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: radius },
  shareAllText: { color: '#fff', fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  section: { marginHorizontal: 16, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.mutedForeground, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionCount: { fontSize: 13, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  addItemText: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  emptyText: { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13, fontStyle: 'italic' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius, borderWidth: 1, marginBottom: 6 },
  itemIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  itemLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.foreground, fontFamily: 'Inter_500Medium' },
  itemSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  itemAction: { padding: 6 },
  reqItemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius, borderWidth: 1, marginBottom: 6 },
  reqCheckBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  reqItemLabel: { fontSize: 14, color: colors.foreground, fontFamily: 'Inter_500Medium' },
  reqItemLabelDone: { textDecorationLine: 'line-through', color: colors.mutedForeground },
  reqItemSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius, borderWidth: 1, marginBottom: 6 },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkText: { flex: 1, fontSize: 14, color: colors.foreground, fontFamily: 'Inter_400Regular' },
  checkTextDone: { textDecorationLine: 'line-through', color: colors.mutedForeground },
  addCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius, borderWidth: 1, marginBottom: 6 },
  checkInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', paddingVertical: 0 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  addBtnText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  reqInput: { borderWidth: 1, borderRadius: radius, padding: 14, fontSize: 14, fontFamily: 'Inter_400Regular', minHeight: 100 },
  reqText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 21 },
  reqEditBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  reqEditText: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  reqActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  reqActionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius, borderWidth: 1 },
  reqActionText: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  shareModal: { flex: 1 },
  shareModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  shareModalTitle: { fontSize: 17, fontWeight: '600', color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
  shareModalSub: { fontSize: 13, fontFamily: 'Inter_400Regular', paddingHorizontal: 20, paddingVertical: 12 },
  shareConfirmBtn: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  shareFileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius, borderWidth: 1, marginBottom: 8 },
  shareCheckBox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
