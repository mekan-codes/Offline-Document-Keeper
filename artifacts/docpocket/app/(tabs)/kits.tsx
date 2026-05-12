import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useKits } from '@/contexts/KitsContext';
import { KitCard } from '@/components/KitCard';
import { EmptyState } from '@/components/EmptyState';
import { AddKitModal } from '@/components/AddKitModal';
import { SearchBar } from '@/components/SearchBar';

export default function KitsTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { kits, loading } = useKits();
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredKits = searchQuery.trim()
    ? kits.filter((kit) => {
      const q = searchQuery.toLowerCase();
      return (
        kit.name.toLowerCase().includes(q) ||
        (kit.note || '').toLowerCase().includes(q) ||
        (kit.requirementsNote || '').toLowerCase().includes(q) ||
        (kit.checklistItems || []).some(item => item.text.toLowerCase().includes(q)) ||
        (kit.requiredItems || []).some(item => item.label.toLowerCase().includes(q))
      );
    })
    : kits;

  const s = styles(colors);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Kits</Text>
          <Text style={s.headerSub}>{filteredKits.length} kit{filteredKits.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <Text style={s.hint}>Situation-based collections of files and info you need in one place</Text>
      <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search kits, requirements, checklist..." />

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={filteredKits}
          keyExtractor={k => k.id}
          renderItem={({ item }) => (
            <KitCard kit={item} onPress={() => router.push(`/kit/${item.id}`)} />
          )}
          contentContainerStyle={[s.list, filteredKits.length === 0 && { flex: 1 }]}
          ListEmptyComponent={
            <EmptyState
              icon="briefcase-outline"
              title="No kits yet"
              subtitle='Create a "Thailand Visa" or "School Submission" kit to group all needed files and info'
            />
          }
          showsVerticalScrollIndicator={false}
          scrollEnabled={filteredKits.length > 0}
        />
      )}

      <AddKitModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8, paddingTop: 8 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: colors.foreground, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', paddingHorizontal: 20, marginBottom: 12 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingBottom: 100 },
});
