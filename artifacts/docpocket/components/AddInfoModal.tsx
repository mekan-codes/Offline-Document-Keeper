import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useInfo } from '@/contexts/InfoContext';
import { INFO_CATEGORY_CONFIG } from '@/constants/categories';
import type { InfoCard, InfoCategory } from '@/types';

const CATEGORIES: InfoCategory[] = ['identity', 'contact', 'address', 'school', 'travel', 'emergency', 'custom'];

interface AddInfoModalProps {
  visible: boolean;
  onClose: () => void;
  editCard?: InfoCard | null;
}

export function AddInfoModal({ visible, onClose, editCard }: AddInfoModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addCard, updateCard } = useInfo();

  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [category, setCategory] = useState<InfoCategory>('identity');
  const [isSensitive, setIsSensitive] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editCard) {
      setTitle(editCard.title);
      setValue(editCard.value);
      setCategory(editCard.category);
      setIsSensitive(editCard.isSensitive);
      setIsFavorite(editCard.isFavorite);
    } else {
      setTitle(''); setValue(''); setCategory('identity'); setIsSensitive(false); setIsFavorite(false);
    }
  }, [editCard, visible]);

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Required', 'Please enter a title'); return; }
    if (!value.trim()) { Alert.alert('Required', 'Please enter a value'); return; }
    setSaving(true);
    try {
      if (editCard) {
        await updateCard(editCard.id, { title: title.trim(), value: value.trim(), category, isSensitive, isFavorite });
      } else {
        await addCard({ title: title.trim(), value: value.trim(), category, isSensitive, isFavorite, tags: [] });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const s = styles(colors, colors.radius);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{editCard ? 'Edit Info Card' : 'New Info Card'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[s.saveBtn, { color: colors.primary }]}>{saving ? '...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={s.form} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>Title *</Text>
          <TextInput style={[s.input, { borderColor: colors.border, color: colors.foreground }]}
            value={title} onChangeText={setTitle} placeholder="e.g. Passport Number, Phone, Email"
            placeholderTextColor={colors.mutedForeground} />

          <Text style={s.label}>Value *</Text>
          <TextInput style={[s.input, { borderColor: colors.border, color: colors.foreground }]}
            value={value} onChangeText={setValue} placeholder="Enter the value"
            placeholderTextColor={colors.mutedForeground} multiline />

          <Text style={s.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
            {CATEGORIES.map(c => {
              const cfg = INFO_CATEGORY_CONFIG[c];
              const active = category === c;
              return (
                <TouchableOpacity key={c} style={[s.catChip, { backgroundColor: active ? cfg.color : colors.muted, borderColor: active ? cfg.color : colors.border }]}
                  onPress={() => setCategory(c)}>
                  <Text style={[s.catChipText, { color: active ? '#fff' : colors.mutedForeground }]}>{cfg.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {[
            { label: 'Sensitive Value', sub: 'Will be masked until revealed', val: isSensitive, set: setIsSensitive, color: colors.primary },
            { label: 'Pin to Top', sub: 'Show at the top of the list', val: isFavorite, set: setIsFavorite, color: '#F59E0B' },
          ].map((row, i) => (
            <View key={i} style={s.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleLabel}>{row.label}</Text>
                <Text style={s.toggleSub}>{row.sub}</Text>
              </View>
              <TouchableOpacity style={[s.toggle, { backgroundColor: row.val ? row.color : colors.muted }]}
                onPress={() => row.set(!row.val)}>
                <View style={[s.toggleKnob, { marginLeft: row.val ? 20 : 2 }]} />
              </TouchableOpacity>
            </View>
          ))}
          <View style={{ height: 80 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = (colors: ReturnType<typeof useColors>, radius: number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 17, fontWeight: '600', color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
  saveBtn: { fontSize: 16, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  form: { flex: 1, padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1, borderRadius: radius, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: 'Inter_400Regular', backgroundColor: colors.card },
  catRow: { gap: 8, paddingVertical: 4 },
  catChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  catChipText: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingVertical: 8, gap: 16 },
  toggleLabel: { fontSize: 15, fontWeight: '500', color: colors.foreground, fontFamily: 'Inter_500Medium' },
  toggleSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  toggle: { width: 44, height: 24, borderRadius: 12, justifyContent: 'center', flexShrink: 0 },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', elevation: 2 },
});
