import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useInfo } from '@/contexts/InfoContext';
import { InfoCardItem } from '@/components/InfoCardItem';
import { SearchBar } from '@/components/SearchBar';
import { FilterChips } from '@/components/FilterChips';
import { EmptyState } from '@/components/EmptyState';
import { AddInfoModal } from '@/components/AddInfoModal';
import { INFO_CATEGORY_CONFIG } from '@/constants/categories';
import type { InfoCard } from '@/types';

const CATEGORY_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'identity', label: 'Identity', color: '#3B82F6' },
  { key: 'contact', label: 'Contact', color: '#10B981' },
  { key: 'address', label: 'Address', color: '#F59E0B' },
  { key: 'school', label: 'School', color: '#8B5CF6' },
  { key: 'travel', label: 'Travel', color: '#00C2CC' },
  { key: 'emergency', label: 'Emergency', color: '#EF4444' },
  { key: 'custom', label: 'Custom', color: '#6B7280' },
];

export default function InfoTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    filteredCards, loading, searchQuery, setSearchQuery,
    activeCategory, setActiveCategory, deleteCard, updateCard,
  } = useInfo();
  const [showAdd, setShowAdd] = useState(false);
  const [editCard, setEditCard] = useState<InfoCard | null>(null);

  const handleDelete = (card: InfoCard) => {
    Alert.alert('Delete Card', `Delete "${card.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCard(card.id) },
    ]);
  };

  const handleEdit = (card: InfoCard) => {
    setEditCard(card);
    setShowAdd(true);
  };

  const handleFavorite = (card: InfoCard) => {
    updateCard(card.id, { isFavorite: !card.isFavorite });
  };

  const s = styles(colors);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Info</Text>
          <Text style={s.headerSub}>{filteredCards.length} card{filteredCards.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={() => { setEditCard(null); setShowAdd(true); }}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search info cards..." />
      <FilterChips chips={CATEGORY_CHIPS} active={activeCategory} onSelect={setActiveCategory} />

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={filteredCards}
          keyExtractor={c => c.id}
          renderItem={({ item }) => (
            <InfoCardItem
              card={item}
              onEdit={() => handleEdit(item)}
              onDelete={() => handleDelete(item)}
              onFavorite={() => handleFavorite(item)}
            />
          )}
          contentContainerStyle={[s.list, filteredCards.length === 0 && { flex: 1 }]}
          ListEmptyComponent={
            <EmptyState
              icon="card-outline"
              title="No info cards yet"
              subtitle="Add passport number, phone, address, emergency contact — anything you copy often"
            />
          }
          showsVerticalScrollIndicator={false}
          scrollEnabled={filteredCards.length > 0}
        />
      )}

      <AddInfoModal
        visible={showAdd}
        onClose={() => { setShowAdd(false); setEditCard(null); }}
        editCard={editCard}
      />
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: colors.foreground, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingBottom: 100 },
});
