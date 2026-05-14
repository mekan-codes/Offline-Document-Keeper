import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
  Platform, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useKits } from '@/contexts/KitsContext';
import { KIT_COLORS, KIT_ICON_NAMES } from '@/constants/categories';
import { makeChecklistItem, makeRequiredItem } from '@/storage/db';
import type { ChecklistItem, RequiredItem } from '@/types';

interface Template {
  name: string;
  icon: string;
  color: string;
  checklistItems: string[];
  requiredItems: string[];
  requirementsNote: string;
}

const TEMPLATES: Template[] = [
  {
    name: 'Visa Application',
    icon: 'airplane',
    color: '#8B5CF6',
    checklistItems: [
      'Passport scan added',
      'ID photo (white background) added',
      'Flight ticket added',
      'Accommodation info added',
      'Invitation letter added',
      'Emergency contact noted',
      'Form submitted',
    ],
    requiredItems: [
      'Passport scan',
      'ID photo',
      'Flight ticket',
      'Accommodation info',
      'Invitation letter',
      'Emergency contact',
    ],
    requirementsNote: 'Photo size: ___\nMax file size: ___\nAccepted formats: PDF, JPEG\nFilename rules: ___\nSubmission deadline: ___',
  },
  {
    name: 'School Submission',
    icon: 'school',
    color: '#F59E0B',
    checklistItems: [
      'Required files attached',
      'Correct filename format used',
      'Deadline checked',
      'Recipient email confirmed',
      'Submitted and confirmation received',
    ],
    requiredItems: [
      'Required document',
      'Correct filename',
      'Deadline',
      'Recipient email',
    ],
    requirementsNote: 'Filename format: ___\nDeadline: ___\nRecipient email: ___\nAccepted file type: ___',
  },
  {
    name: 'Travel / Airport',
    icon: 'airplane',
    color: '#10B981',
    checklistItems: [
      'Passport',
      'Flight ticket',
      'Visa / entry document',
      'Accommodation booking',
      'Charger & adaptor',
      'Emergency contact info',
      'Travel insurance',
    ],
    requiredItems: [
      'Passport',
      'Flight ticket',
      'Visa / entry document',
      'Accommodation',
      'Emergency contact',
    ],
    requirementsNote: '',
  },
  {
    name: 'Scholarship / Application',
    icon: 'document-text',
    color: '#3B82F6',
    checklistItems: [
      'Application form completed',
      'Recommendation letter added',
      'Academic transcript added',
      'Personal statement written',
      'Evidence files added',
      'Submitted before deadline',
    ],
    requiredItems: [
      'Application form',
      'Recommendation letter',
      'Transcript',
      'Personal statement',
      'Evidence files',
    ],
    requirementsNote: 'Deadline: ___\nSubmission portal: ___\nRequired documents: ___',
  },
  {
    name: 'Medical Visit',
    icon: 'medkit',
    color: '#EF4444',
    checklistItems: [
      'Passport / ID ready',
      'Insurance card ready',
      'Appointment info noted',
      'Medical history / notes prepared',
      'Payment method ready',
    ],
    requiredItems: [
      'Passport / ID',
      'Insurance',
      'Appointment information',
      'Medical notes',
    ],
    requirementsNote: 'Hospital / clinic: ___\nAppointment date: ___\nInsurance: ___',
  },
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
  const [appliedTemplate, setAppliedTemplate] = useState<Template | null>(null);

  useEffect(() => {
    if (visible) {
      setName(''); setColor(KIT_COLORS[0]); setIcon(KIT_ICON_NAMES[0]); setAppliedTemplate(null);
    }
  }, [visible]);

  const applyTemplate = (t: Template) => {
    setName(t.name); setColor(t.color); setIcon(t.icon); setAppliedTemplate(t);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Enter a kit name'); return; }
    setSaving(true);
    try {
      const checklistItems: ChecklistItem[] = appliedTemplate
        ? appliedTemplate.checklistItems.map(text => makeChecklistItem(text))
        : [];
      const requiredItems: RequiredItem[] = appliedTemplate
        ? appliedTemplate.requiredItems.map(label => makeRequiredItem(label))
        : [];
      await addNewKit({
        name: name.trim(),
        color,
        icon,
        fileIds: [],
        infoCardIds: [],
        checklistItems,
        requiredItems,
        requirementsNote: appliedTemplate?.requirementsNote ?? '',
        note: '',
      });
      onClose();
    } finally { setSaving(false); }
  };

  const s = styles(colors, colors.radius);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      hardwareAccelerated
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[s.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
      >
        <View style={s.header}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.foreground} /></TouchableOpacity>
          <Text style={s.headerTitle}>New Kit</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[s.saveBtn, { color: colors.primary }]}>{saving ? '...' : 'Create'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={s.form}
          contentContainerStyle={[s.formContent, { paddingBottom: insets.bottom + 140 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          <View style={s.preview}>
            <View style={[s.previewIcon, { backgroundColor: color + '22' }]}>
              <Ionicons name={icon as any} size={36} color={color} />
            </View>
            {appliedTemplate && (
              <View style={[s.templateBadge, { backgroundColor: color + '20' }]}>
                <Ionicons name="checkmark-circle" size={12} color={color} />
                <Text style={[s.templateBadgeText, { color }]}>
                  {appliedTemplate.checklistItems.length} checklist · {appliedTemplate.requiredItems.length} required items
                </Text>
              </View>
            )}
          </View>

          <Text style={s.label}>Name *</Text>
          <TextInput style={[s.input, { borderColor: colors.border, color: colors.foreground }]}
            value={name} onChangeText={setName} placeholder="e.g. Thailand Visa, School Submission"
            placeholderTextColor={colors.mutedForeground} cursorColor={colors.primary} selectionColor={colors.primary} />

          <Text style={s.label}>Quick Templates</Text>
          <Text style={s.labelSub}>Select a template to pre-fill checklist, required items, and requirements</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.templateRow}>
            {TEMPLATES.map((t, i) => {
              const isActive = appliedTemplate?.name === t.name;
              return (
                <TouchableOpacity key={i}
                  style={[s.templateChip, { borderColor: isActive ? t.color : colors.border, backgroundColor: isActive ? t.color + '15' : colors.muted }]}
                  onPress={() => applyTemplate(t)}>
                  <Ionicons name={t.icon as any} size={14} color={t.color} />
                  <Text style={[s.templateText, { color: isActive ? t.color : colors.foreground }]}>{t.name}</Text>
                  {isActive && <Ionicons name="checkmark-circle" size={14} color={t.color} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={s.label}>Color</Text>
          <View style={s.colorRow}>
            {KIT_COLORS.map(c => (
              <TouchableOpacity key={c} style={[s.colorDot, { backgroundColor: c }, c === color && s.colorDotActive]}
                onPress={() => setColor(c)} />
            ))}
          </View>

          <Text style={s.label}>Icon</Text>
          <View style={s.iconGrid}>
            {KIT_ICON_NAMES.map(ic => (
              <TouchableOpacity key={ic}
                style={[s.iconOpt, { backgroundColor: icon === ic ? color + '20' : colors.muted, borderColor: icon === ic ? color : colors.border }]}
                onPress={() => setIcon(ic)}>
                <Ionicons name={ic as any} size={22} color={icon === ic ? color : colors.mutedForeground} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = (colors: ReturnType<typeof useColors>, radius: number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 17, fontWeight: '600', color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
  saveBtn: { fontSize: 16, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  form: { flex: 1 },
  formContent: { padding: 20 },
  preview: { alignItems: 'center', marginBottom: 8, marginTop: 8, gap: 8 },
  previewIcon: { width: 80, height: 80, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  templateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  templateBadgeText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  label: { fontSize: 13, fontWeight: '600', color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', marginBottom: 4, marginTop: 16 },
  labelSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: radius, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: 'Inter_400Regular', backgroundColor: colors.card },
  templateRow: { gap: 8, paddingVertical: 4 },
  templateChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  templateText: { fontSize: 12, fontWeight: '500', fontFamily: 'Inter_500Medium' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorDot: { width: 36, height: 36, borderRadius: 18 },
  colorDotActive: { borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconOpt: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
