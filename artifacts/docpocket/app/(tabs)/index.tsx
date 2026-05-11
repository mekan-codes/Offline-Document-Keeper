import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useVault } from '@/contexts/VaultContext';
import { FileCard } from '@/components/FileCard';
import { SearchBar } from '@/components/SearchBar';
import { FilterChips } from '@/components/FilterChips';
import { EmptyState } from '@/components/EmptyState';
import { AddFileModal } from '@/components/AddFileModal';
import { FILE_CATEGORY_CONFIG } from '@/constants/categories';
import type { DocumentFile } from '@/types';

const FILTER_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'recent', label: 'Recent' },
  { key: 'identity', label: 'Identity', color: '#3B82F6' },
  { key: 'visa', label: 'Visa', color: '#8B5CF6' },
  { key: 'travel', label: 'Travel', color: '#10B981' },
  { key: 'school', label: 'School', color: '#F59E0B' },
  { key: 'medical', label: 'Medical', color: '#EF4444' },
  { key: 'photos', label: 'Photos', color: '#EC4899' },
  { key: 'pdfs', label: 'PDFs' },
];

export default function VaultTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    filteredFiles, loading, searchQuery, setSearchQuery,
    activeFilter, setActiveFilter, updateFileById, deleteFileById,
  } = useVault();
  const [showAdd, setShowAdd] = useState(false);

  const handleShare = async (file: DocumentFile) => {
    if (Platform.OS === 'web') { Alert.alert('Not supported', 'Sharing is not available on web'); return; }
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) { Alert.alert('Not available', 'Sharing is not available on this device'); return; }
      await Sharing.shareAsync(file.localUri, { mimeType: file.mimeType, dialogTitle: file.name });
      await updateFileById(file.id, { lastSharedAt: new Date().toISOString() });
    } catch (e) {
      Alert.alert('Error', 'Could not share file');
    }
  };

  const handleDelete = (file: DocumentFile) => {
    Alert.alert('Delete File', `Delete "${file.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await FileSystem.deleteAsync(file.localUri, { idempotent: true }); } catch {}
          await deleteFileById(file.id);
        }
      },
    ]);
  };

  const handleFavorite = async (file: DocumentFile) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateFileById(file.id, { isFavorite: !file.isFavorite });
  };

  const s = styles(colors, colors.radius);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Vault</Text>
          <Text style={s.headerSub}>{filteredFiles.length} document{filteredFiles.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search files, tags, notes..." />
      <FilterChips chips={FILTER_CHIPS} active={activeFilter} onSelect={setActiveFilter} />

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={filteredFiles}
          keyExtractor={f => f.id}
          renderItem={({ item }) => (
            <FileCard
              file={item}
              onPress={() => updateFileById(item.id, { lastOpenedAt: new Date().toISOString() })}
              onShare={() => handleShare(item)}
              onFavorite={() => handleFavorite(item)}
            />
          )}
          contentContainerStyle={[s.list, filteredFiles.length === 0 && { flex: 1 }]}
          ListEmptyComponent={
            <EmptyState
              icon="folder-open-outline"
              title="No files yet"
              subtitle="Tap + to add your first document — passport scan, PDF, or photo"
            />
          }
          showsVerticalScrollIndicator={false}
          scrollEnabled={filteredFiles.length > 0}
        />
      )}

      <AddFileModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>, radius: number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: colors.foreground, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingBottom: 100 },
});
