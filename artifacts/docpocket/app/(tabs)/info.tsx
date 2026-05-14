import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Platform, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useInfo } from '@/contexts/InfoContext';
import { useKits } from '@/contexts/KitsContext';
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
  const { kits, updateKitById, refreshKits } = useKits();
  const [showAdd, setShowAdd] = useState(false);
  const [editCard, setEditCard] = useState<InfoCard | null>(null);
  const [addToKitCard, setAddToKitCard] = useState<InfoCard | null>(null);

  const handleDelete = (card: InfoCard) => {
    Alert.alert('Delete Card', `Delete "${card.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteCard(card.id); await refreshKits(); } },
    ]);
  };

  const handleEdit = (card: InfoCard) => {
    setEditCard(card);
    setShowAdd(true);
  };

  const handleFavorite = (card: InfoCard) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void updateCard(card.id, { isFavorite: !card.isFavorite });
  };

  const handleAddCardToKit = async (kitId: string) => {
    if (!addToKitCard) return;
    const target = kits.find(k => k.id === kitId);
    if (!target) return;
    if (target.infoCardIds.includes(addToKitCard.id)) {
      Alert.alert('Already Added', `"${addToKitCard.title}" is already in "${target.name}".`);
      return;
    }
    await updateKitById(target.id, { infoCardIds: [...target.infoCardIds, addToKitCard.id] });
    setAddToKitCard(null);
    Alert.alert('Added to Kit', `"${addToKitCard.title}" was added to "${target.name}".`);
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
              onAddToKit={() => setAddToKitCard(item)}
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

      <Modal visible={addToKitCard !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAddToKitCard(null)}>
        <View style={[s.kitModal, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, backgroundColor: colors.background }]}>
          <View style={s.kitModalHeader}>
            <TouchableOpacity onPress={() => setAddToKitCard(null)}>
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
              const alreadyAdded = addToKitCard ? kit.infoCardIds.includes(addToKitCard.id) : false;
              return (
                <TouchableOpacity
                  style={[s.kitRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleAddCardToKit(kit.id)}
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

const styles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: colors.foreground, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingBottom: 100 },
  kitModal: { flex: 1 },
  kitModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  kitModalTitle: { fontSize: 17, fontWeight: '600', color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
  kitList: { padding: 16 },
  emptyKitList: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  emptyKitText: { color: colors.mutedForeground, textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 14 },
  kitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: colors.radius, borderWidth: 1, marginBottom: 8 },
  kitRowIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kitRowName: { flex: 1, fontSize: 15, color: colors.foreground, fontFamily: 'Inter_500Medium' },
});
