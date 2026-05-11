import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useVault } from '@/contexts/VaultContext';
import { FILE_CATEGORY_CONFIG } from '@/constants/categories';
import type { FileCategory } from '@/types';

const CATEGORIES: FileCategory[] = ['identity', 'visa', 'travel', 'school', 'medical', 'photos', 'other'];

interface AddFileModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddFileModal({ visible, onClose }: AddFileModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addNewFile } = useVault();

  const [step, setStep] = useState<'pick' | 'details'>('pick');
  const [pickedUri, setPickedUri] = useState('');
  const [pickedName, setPickedName] = useState('');
  const [pickedMime, setPickedMime] = useState('');
  const [pickedSize, setPickedSize] = useState(0);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FileCategory>('other');
  const [note, setNote] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [isSensitive, setIsSensitive] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep('pick');
    setPickedUri(''); setPickedName(''); setPickedMime(''); setPickedSize(0);
    setName(''); setCategory('other'); setNote(''); setExpiryDate('');
    setIsSensitive(false); setIsFavorite(false); setSaving(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleDocumentPick = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (res.canceled) return;
      const asset = res.assets[0];
      setPickedUri(asset.uri);
      setPickedName(asset.name);
      setPickedMime(asset.mimeType || 'application/octet-stream');
      setPickedSize(asset.size || 0);
      setName(asset.name.replace(/\.[^/.]+$/, ''));
      setStep('details');
    } catch (e) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleImagePick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access to import images'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.9, allowsEditing: false });
      if (res.canceled) return;
      const asset = res.assets[0];
      const fn = `photo_${Date.now()}.jpg`;
      setPickedUri(asset.uri);
      setPickedName(fn);
      setPickedMime('image/jpeg');
      setPickedSize(0);
      setName(fn.replace('.jpg', ''));
      setCategory('photos');
      setStep('details');
    } catch (e) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleCameraCapture = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Allow camera access to take photos'); return; }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.9 });
      if (res.canceled) return;
      const asset = res.assets[0];
      const fn = `scan_${Date.now()}.jpg`;
      setPickedUri(asset.uri);
      setPickedName(fn);
      setPickedMime('image/jpeg');
      setPickedSize(0);
      setName(`Document Scan ${new Date().toLocaleDateString()}`);
      setCategory('other');
      setStep('details');
    } catch (e) {
      Alert.alert('Error', 'Failed to open camera');
    }
  };

  const handleSave = async () => {
    if (!pickedUri) return;
    if (!name.trim()) { Alert.alert('Name required', 'Please enter a name for this file'); return; }
    setSaving(true);
    try {
      const dir = (FileSystem as any).documentDirectory + 'docpocket/';
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const ext = pickedName.includes('.') ? '.' + pickedName.split('.').pop() : '';
      const destName = `${Date.now().toString(36)}${ext}`;
      const destUri = dir + destName;
      await FileSystem.copyAsync({ from: pickedUri, to: destUri });
      const info = await FileSystem.getInfoAsync(destUri);
      await addNewFile({
        name: name.trim(),
        originalFileName: pickedName,
        localUri: destUri,
        mimeType: pickedMime,
        sizeBytes: (info.exists && 'size' in info) ? (info.size || pickedSize) : pickedSize,
        category,
        tags: [],
        note,
        requirementsNote: '',
        expiryDate: expiryDate || undefined,
        isFavorite,
        isSensitive,
      });
      handleClose();
    } catch (e) {
      Alert.alert('Error', 'Failed to save file. ' + (e instanceof Error ? e.message : ''));
    } finally {
      setSaving(false);
    }
  };

  const s = styles(colors, colors.radius);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[s.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={step === 'details' ? () => setStep('pick') : handleClose}>
            <Ionicons name={step === 'details' ? 'arrow-back' : 'close'} size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{step === 'pick' ? 'Add File' : 'File Details'}</Text>
          {step === 'details' ? (
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.primary} /> : (
                <Text style={[s.saveBtn, { color: colors.primary }]}>Save</Text>
              )}
            </TouchableOpacity>
          ) : <View style={{ width: 40 }} />}
        </View>

        {step === 'pick' ? (
          <View style={s.pickOptions}>
            <Text style={s.pickTitle}>Choose how to add a file</Text>
            {[
              { icon: 'document-outline', label: 'Import File (PDF, DOC)', action: handleDocumentPick },
              { icon: 'images-outline', label: 'Import from Gallery', action: handleImagePick },
              { icon: 'camera-outline', label: 'Take Photo / Scan', action: handleCameraCapture },
            ].map((opt, i) => (
              <TouchableOpacity key={i} style={s.pickOption} onPress={opt.action}>
                <View style={[s.pickIconWrap, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name={opt.icon as any} size={26} color={colors.primary} />
                </View>
                <Text style={s.pickLabel}>{opt.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <ScrollView style={s.form} keyboardShouldPersistTaps="handled">
            <View style={s.pickedFile}>
              <Ionicons name="document" size={20} color={colors.primary} />
              <Text style={s.pickedFileName} numberOfLines={1}>{pickedName}</Text>
            </View>

            <Text style={s.label}>Name *</Text>
            <TextInput style={[s.input, { borderColor: colors.border, color: colors.foreground }]}
              value={name} onChangeText={setName} placeholder="Document name" placeholderTextColor={colors.mutedForeground} />

            <Text style={s.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
              {CATEGORIES.map(c => {
                const cfg = FILE_CATEGORY_CONFIG[c];
                const active = category === c;
                return (
                  <TouchableOpacity key={c} style={[s.catChip, { backgroundColor: active ? cfg.color : colors.muted, borderColor: active ? cfg.color : colors.border }]}
                    onPress={() => setCategory(c)}>
                    <Text style={[s.catChipText, { color: active ? '#fff' : colors.mutedForeground }]}>{cfg.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={s.label}>Note (optional)</Text>
            <TextInput style={[s.input, s.textarea, { borderColor: colors.border, color: colors.foreground }]}
              value={note} onChangeText={setNote} placeholder="Add a note..." placeholderTextColor={colors.mutedForeground}
              multiline numberOfLines={3} textAlignVertical="top" />

            <Text style={s.label}>Expiry Date (optional, YYYY-MM-DD)</Text>
            <TextInput style={[s.input, { borderColor: colors.border, color: colors.foreground }]}
              value={expiryDate} onChangeText={setExpiryDate} placeholder="2027-01-15" placeholderTextColor={colors.mutedForeground} />

            <View style={s.toggleRow}>
              <View>
                <Text style={s.toggleLabel}>Sensitive Document</Text>
                <Text style={s.toggleSub}>Will be hidden in privacy mode</Text>
              </View>
              <TouchableOpacity style={[s.toggle, { backgroundColor: isSensitive ? colors.primary : colors.muted }]}
                onPress={() => setIsSensitive(!isSensitive)}>
                <View style={[s.toggleKnob, { marginLeft: isSensitive ? 20 : 2 }]} />
              </TouchableOpacity>
            </View>

            <View style={s.toggleRow}>
              <Text style={s.toggleLabel}>Add to Favorites</Text>
              <TouchableOpacity style={[s.toggle, { backgroundColor: isFavorite ? '#F59E0B' : colors.muted }]}
                onPress={() => setIsFavorite(!isFavorite)}>
                <View style={[s.toggleKnob, { marginLeft: isFavorite ? 20 : 2 }]} />
              </TouchableOpacity>
            </View>

            <View style={{ height: 80 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = (colors: ReturnType<typeof useColors>, radius: number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 17, fontWeight: '600', color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
  saveBtn: { fontSize: 16, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  pickOptions: { flex: 1, padding: 24, gap: 12 },
  pickTitle: { fontSize: 15, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginBottom: 8 },
  pickOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: 16, borderRadius: radius, gap: 14, borderWidth: 1, borderColor: colors.border },
  pickIconWrap: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pickLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.foreground, fontFamily: 'Inter_500Medium' },
  form: { flex: 1, padding: 20 },
  pickedFile: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary + '15', padding: 12, borderRadius: radius, marginBottom: 20 },
  pickedFileName: { flex: 1, fontSize: 13, color: colors.primary, fontFamily: 'Inter_500Medium' },
  label: { fontSize: 13, fontWeight: '600', color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1, borderRadius: radius, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: 'Inter_400Regular', backgroundColor: colors.card },
  textarea: { height: 80, paddingTop: 11 },
  catRow: { gap: 8, paddingVertical: 4 },
  catChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  catChipText: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingVertical: 8 },
  toggleLabel: { fontSize: 15, fontWeight: '500', color: colors.foreground, fontFamily: 'Inter_500Medium' },
  toggleSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  toggle: { width: 44, height: 24, borderRadius: 12, justifyContent: 'center' },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
});
