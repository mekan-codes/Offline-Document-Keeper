import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useVault } from '@/contexts/VaultContext';
import { useSettings } from '@/contexts/SettingsContext';
import { FileCard } from '@/components/FileCard';
import { SearchBar } from '@/components/SearchBar';
import { FilterChips } from '@/components/FilterChips';
import { EmptyState } from '@/components/EmptyState';
import { AddFileModal } from '@/components/AddFileModal';
import { PrivateVaultModal } from '@/components/PrivateVaultModal';
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
  const { settings } = useSettings();
  const {
    files, filteredFiles, loading, searchQuery, setSearchQuery,
    activeFilter, setActiveFilter, updateFileById, deleteFileById,
  } = useVault();
  const [showAdd, setShowAdd] = useState(false);
  const [showPrivate, setShowPrivate] = useState(false);

  const visibleFiles = settings.privacyMode
    ? filteredFiles.filter(f => !f.isSensitive)
    : filteredFiles;

  const privateCount = settings.privacyMode ? files.filter(f => f.isSensitive).length : 0;

  const handleOpen = async (file: DocumentFile) => {
    await updateFileById(file.id, { lastOpenedAt: new Date().toISOString() });
    router.push(`/file/${file.id}`);
  };

  const handleShare = async (file: DocumentFile) => {
    if (Platform.OS === 'web') { Alert.alert('Not supported', 'Sharing is not available on web'); return; }
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) { Alert.alert('Not available', 'Sharing is not available on this device'); return; }
      await Sharing.shareAsync(file.localUri, { mimeType: file.mimeType, dialogTitle: file.name });
      await updateFileById(file.id, { lastSharedAt: new Date().toISOString() });
    } catch {
      Alert.alert('Error', 'Could not share file');
    }
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
          <Text style={s.headerSub}>{visibleFiles.length} document{visibleFiles.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity
            style={[s.iconBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
            onPress={() => setShowPrivate(true)}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowAdd(true)}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search files, tags, notes..." />
      <FilterChips chips={FILTER_CHIPS} active={activeFilter} onSelect={setActiveFilter} />

      {settings.privacyMode && privateCount > 0 && (
        <TouchableOpacity style={[s.privateBanner, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]} onPress={() => setShowPrivate(true)}>
          <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
          <Text style={[s.privateBannerText, { color: colors.primary }]}>
            {privateCount} private file{privateCount !== 1 ? 's' : ''} hidden
          </Text>
          <Text style={[s.privateBannerLink, { color: colors.primary }]}>Unlock →</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={visibleFiles}
          keyExtractor={f => f.id}
          renderItem={({ item }) => (
            <FileCard
              file={item}
              onPress={() => handleOpen(item)}
              onShare={() => handleShare(item)}
              onFavorite={() => handleFavorite(item)}
            />
          )}
          contentContainerStyle={[s.list, visibleFiles.length === 0 && { flex: 1 }]}
          ListEmptyComponent={
            <EmptyState
              icon="folder-open-outline"
              title="No files yet"
              subtitle="Tap + to add your first document — passport scan, PDF, or photo"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <AddFileModal visible={showAdd} onClose={() => setShowAdd(false)} />
      <PrivateVaultModal visible={showPrivate} onClose={() => setShowPrivate(false)} />
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>, radius: number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: colors.foreground, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  privateBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius, borderWidth: 1 },
  privateBannerText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium' },
  privateBannerLink: { fontSize: 13, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingBottom: 100 },
});
