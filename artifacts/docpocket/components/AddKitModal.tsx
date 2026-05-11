import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useKits } from '@/contexts/KitsContext';
import { KIT_COLORS, KIT_ICON_NAMES } from '@/constants/categories';
import type { Kit } from '@/types';

const KIT_TEMPLATES = [
  { name: 'Visa Application', icon: 'airplane', color: '#8B5CF6' },
  { name: 'School Submission', icon: 'school', color: '#F59E0B' },
  { name: 'Travel / Airport', icon: 'airplane', color: '#10B981' },
  { name: 'Scholarship', icon: 'document-text', color: '#3B82F6' },
  { name: 'Medical Visit', icon: 'medkit', color: '#EF4444' },
];

interface AddKitModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddKitModal({ visible, onClose }: AddKitModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addNewKit } = useKits();

  const [name, setName] = useState('');
  const [color, setColor] = useState(KIT_COLORS[0]);
  const [icon, setIcon] = useState(KIT_ICON_NAMES[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) { setName(''); setColor(KIT_COLORS[0]); setIcon(KIT_ICON_NAMES[0]); }
  }, [visible]);

  const applyTemplate = (t: typeof KIT_TEMPLATES[0]) => {
    setName(t.name); setColor(t.color); setIcon(t.icon);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Enter a kit name'); return; }
    setSaving(true);
    try {
      await addNewKit({ name: name.trim(), color, icon, fileIds: [], infoCardIds: [], checklistItems: [], requirementsNote: '', note: '' });
      onClose();
    } finally { setSaving(false); }
  };

  const s = styles(colors, colors.radius);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.foreground} /></TouchableOpacity>
          <Text style={s.headerTitle}>New Kit</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[s.saveBtn, { color: colors.primary }]}>{saving ? '...' : 'Create'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={s.form} keyboardShouldPersistTaps="handled">
          <View style={s.preview}>
            <View style={[s.previewIcon, { backgroundColor: color + '22' }]}>
              <Ionicons name={icon as any} size={36} color={color} />
            </View>
          </View>

          <Text style={s.label}>Name *</Text>
          <TextInput style={[s.input, { borderColor: colors.border, color: colors.foreground }]}
            value={name} onChangeText={setName} placeholder="e.g. Thailand Visa, School Submission"
            placeholderTextColor={colors.mutedForeground} />

          <Text style={s.label}>Templates</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.templateRow}>
            {KIT_TEMPLATES.map((t, i) => (
              <TouchableOpacity key={i} style={[s.templateChip, { borderColor: colors.border }]} onPress={() => applyTemplate(t)}>
                <Ionicons name={t.icon as any} size={16} color={t.color} />
                <Text style={[s.templateText, { color: colors.foreground }]}>{t.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.label}>Color</Text>
          <View style={s.colorRow}>
            {KIT_COLORS.map(c => (
              <TouchableOpacity key={c} style={[s.colorDot, { backgroundColor: c }, c === color && s.colorDotActive]} onPress={() => setColor(c)} />
            ))}
          </View>

          <Text style={s.label}>Icon</Text>
          <View style={s.iconGrid}>
            {KIT_ICON_NAMES.map(ic => (
              <TouchableOpacity key={ic} style={[s.iconOpt, { backgroundColor: icon === ic ? color + '20' : colors.muted, borderColor: icon === ic ? color : colors.border }]}
                onPress={() => setIcon(ic)}>
                <Ionicons name={ic as any} size={22} color={icon === ic ? color : colors.mutedForeground} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 60 }} />
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
  preview: { alignItems: 'center', marginBottom: 8, marginTop: 8 },
  previewIcon: { width: 80, height: 80, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1, borderRadius: radius, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: 'Inter_400Regular', backgroundColor: colors.card },
  templateRow: { gap: 8, paddingVertical: 4 },
  templateChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, backgroundColor: colors.muted },
  templateText: { fontSize: 12, fontWeight: '500', fontFamily: 'Inter_500Medium' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorDot: { width: 36, height: 36, borderRadius: 18 },
  colorDotActive: { borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconOpt: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
