import React, { useState, useMemo } from 'react';
import {
  Modal, View, Text, FlatList, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useVault } from '@/contexts/VaultContext';
import { FILE_CATEGORY_CONFIG } from '@/constants/categories';
import { SearchBar } from './SearchBar';
import type { DocumentFile } from '@/types';

interface SelectFilesModalProps {
  visible: boolean;
  onClose: () => void;
  existingFileIds: string[];
  onConfirm: (selectedIds: string[]) => void;
}

export function SelectFilesModal({ visible, onClose, existingFileIds, onConfirm }: SelectFilesModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { files } = useVault();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const availableFiles = useMemo(() => {
    const candidates = files.filter(f => !existingFileIds.includes(f.id));
    if (!searchQuery.trim()) return candidates;
    const q = searchQuery.toLowerCase();
    return candidates.filter(f =>
      f.name.toLowerCase().includes(q) || f.category.includes(q)
    );
  }, [files, existingFileIds, searchQuery]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selected));
    setSelected(new Set());
    setSearchQuery('');
    onClose();
  };

  const handleClose = () => {
    setSelected(new Set());
    setSearchQuery('');
    onClose();
  };

  const s = styles(colors, colors.radius);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[s.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={handleClose}><Ionicons name="close" size={24} color={colors.foreground} /></TouchableOpacity>
          <Text style={s.headerTitle}>Add Files to Kit</Text>
          <TouchableOpacity onPress={handleConfirm} disabled={selected.size === 0}>
            <Text style={[s.addBtn, { color: selected.size > 0 ? colors.primary : colors.mutedForeground }]}>
              Add {selected.size > 0 ? `(${selected.size})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search files..." />

        <FlatList
          data={availableFiles}
          keyExtractor={f => f.id}
          contentContainerStyle={[s.list, availableFiles.length === 0 && { flex: 1 }]}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="document-outline" size={40} color={colors.mutedForeground} />
              <Text style={s.emptyText}>
                {files.length === 0 ? 'No files in Vault yet' : 'All files already added to kit'}
              </Text>
            </View>
          }
          renderItem={({ item: f }) => {
            const cat = FILE_CATEGORY_CONFIG[f.category];
            const isSelected = selected.has(f.id);
            return (
              <TouchableOpacity
                style={[s.row, { backgroundColor: isSelected ? colors.primary + '10' : colors.card, borderColor: isSelected ? colors.primary : colors.border }]}
                onPress={() => toggle(f.id)}
                activeOpacity={0.7}
              >
                <View style={[s.iconWrap, { backgroundColor: cat.color + '20' }]}>
                  <Ionicons name={f.mimeType?.startsWith('image') ? 'image' : 'document-text'} size={20} color={cat.color} />
                </View>
                <View style={s.rowBody}>
                  <Text style={s.rowLabel} numberOfLines={1}>{f.name}</Text>
                  <Text style={s.rowSub}>{cat.label} • {new Date(f.createdAt).toLocaleDateString()}</Text>
                </View>
                <View style={[s.checkbox, { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : 'transparent' }]}>
                  {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = (colors: ReturnType<typeof useColors>, radius: number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 17, fontWeight: '600', color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
  addBtn: { fontSize: 16, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  list: { paddingVertical: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 60 },
  emptyText: { fontSize: 14, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginHorizontal: 16, marginVertical: 4, borderRadius: radius, borderWidth: 1 },
  iconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '500', color: colors.foreground, fontFamily: 'Inter_500Medium' },
  rowSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
