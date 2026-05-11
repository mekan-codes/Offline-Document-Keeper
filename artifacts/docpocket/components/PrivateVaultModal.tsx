import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, FlatList, TouchableOpacity, StyleSheet,
  Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAppLock } from '@/contexts/AppLockContext';
import { useVault } from '@/contexts/VaultContext';
import { useInfo } from '@/contexts/InfoContext';
import { useSettings } from '@/contexts/SettingsContext';
import { PINPad } from './PINPad';
import { FILE_CATEGORY_CONFIG, INFO_CATEGORY_CONFIG } from '@/constants/categories';
import { verifyPin } from '@/storage/pinUtils';

interface PrivateVaultModalProps {
  visible: boolean;
  onClose: () => void;
}

type ListItem =
  | { type: 'section'; title: string; key: string }
  | { type: 'file'; item: ReturnType<typeof useVault>['files'][0]; key: string }
  | { type: 'info'; item: ReturnType<typeof useInfo>['cards'][0]; key: string }
  | { type: 'empty'; message: string; key: string };

export function PrivateVaultModal({ visible, onClose }: PrivateVaultModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isPinSetup, unlockWithBiometrics, hasBiometrics } = useAppLock();
  const { files } = useVault();
  const { cards } = useInfo();
  const { settings } = useSettings();

  const [authenticated, setAuthenticated] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const sensitiveFiles = files.filter(f => f.isSensitive);
  const sensitiveCards = cards.filter(c => c.isSensitive);

  useEffect(() => {
    if (visible) {
      setAuthenticated(false);
      setPinError(null);
      if (!isPinSetup) {
        Alert.alert('PIN Required', 'Set up a PIN in Settings to use the Private Vault.', [{ text: 'OK', onPress: onClose }]);
        return;
      }
      if (hasBiometrics && settings.biometricEnabled && Platform.OS !== 'web') {
        tryBiometrics();
      }
    }
  }, [visible]);

  const tryBiometrics = async () => {
    const ok = await unlockWithBiometrics();
    if (ok) setAuthenticated(true);
  };

  const handlePin = async (pin: string) => {
    setPinError(null);
    const ok = await verifyPin(pin);
    if (ok) {
      setAuthenticated(true);
    } else {
      setPinError('Incorrect PIN');
    }
  };

  const handleShare = async (uri: string, mimeType: string, name: string) => {
    if (Platform.OS === 'web') return;
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(uri, { mimeType, dialogTitle: name });
    } catch {}
  };

  const handleCopy = async (value: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Clipboard.setStringAsync(value);
    if (settings.clearClipboardAfterSeconds > 0) {
      setTimeout(async () => { try { await Clipboard.setStringAsync(''); } catch {} }, settings.clearClipboardAfterSeconds * 1000);
    }
  };

  const handleClose = () => {
    setAuthenticated(false);
    setPinError(null);
    onClose();
  };

  const listData: ListItem[] = authenticated ? [
    { type: 'section', title: `Private Files (${sensitiveFiles.length})`, key: 'sec-files' },
    ...(sensitiveFiles.length === 0
      ? [{ type: 'empty' as const, message: 'No private files. Mark files as Sensitive in their detail page.', key: 'empty-files' }]
      : sensitiveFiles.map(f => ({ type: 'file' as const, item: f, key: `f_${f.id}` }))),
    { type: 'section', title: `Private Info Cards (${sensitiveCards.length})`, key: 'sec-info' },
    ...(sensitiveCards.length === 0
      ? [{ type: 'empty' as const, message: 'No private info cards. Mark info cards as Sensitive.', key: 'empty-info' }]
      : sensitiveCards.map(c => ({ type: 'info' as const, item: c, key: `i_${c.id}` }))),
  ] : [];

  const s = styles(colors, colors.radius);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Ionicons name="shield-checkmark" size={22} color={colors.primary} />
            <Text style={s.headerTitle}>Private Vault</Text>
          </View>
          <TouchableOpacity style={s.lockBtn} onPress={handleClose}>
            <Ionicons name="lock-closed" size={18} color={colors.mutedForeground} />
            <Text style={s.lockText}>Lock</Text>
          </TouchableOpacity>
        </View>

        {!authenticated ? (
          <View style={s.authArea}>
            <PINPad
              title="Private Vault"
              subtitle="Enter your PIN to access private files and info"
              onComplete={handlePin}
              error={pinError}
            />
            {hasBiometrics && settings.biometricEnabled && Platform.OS !== 'web' && (
              <TouchableOpacity style={s.bioBtn} onPress={tryBiometrics}>
                <Ionicons name="finger-print" size={30} color={colors.primary} />
                <Text style={[s.bioText, { color: colors.primary }]}>Use Biometrics</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {(sensitiveFiles.length === 0 && sensitiveCards.length === 0) ? (
              <View style={s.emptyVault}>
                <Ionicons name="shield-outline" size={48} color={colors.mutedForeground} />
                <Text style={s.emptyTitle}>Private vault is empty</Text>
                <Text style={s.emptySub}>Mark files or info cards as Sensitive to store them here.</Text>
              </View>
            ) : (
              <FlatList
                data={listData}
                keyExtractor={item => item.key}
                contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
                renderItem={({ item }) => {
                  if (item.type === 'section') return (
                    <Text style={s.sectionTitle}>{item.title}</Text>
                  );
                  if (item.type === 'empty') return (
                    <Text style={s.emptyText}>{item.message}</Text>
                  );
                  if (item.type === 'file') {
                    const f = item.item;
                    const cat = FILE_CATEGORY_CONFIG[f.category];
                    return (
                      <View style={[s.itemRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={[s.itemIcon, { backgroundColor: cat.color + '20' }]}>
                          <Ionicons name={f.mimeType?.startsWith('image') ? 'image' : 'document-text'} size={20} color={cat.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.itemLabel} numberOfLines={1}>{f.name}</Text>
                          <Text style={s.itemMeta}>{cat.label} • {(f.sizeBytes / 1024).toFixed(0)} KB</Text>
                        </View>
                        <TouchableOpacity style={s.actionBtn} onPress={() => handleShare(f.localUri, f.mimeType, f.name)}>
                          <Ionicons name="share-outline" size={18} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                    );
                  }
                  if (item.type === 'info') {
                    const c = item.item;
                    const cat = INFO_CATEGORY_CONFIG[c.category];
                    return (
                      <View style={[s.itemRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={[s.catDot, { backgroundColor: cat.color }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.itemLabel} numberOfLines={1}>{c.title}</Text>
                          <Text style={s.itemValue} numberOfLines={1}>{c.value}</Text>
                        </View>
                        <TouchableOpacity style={s.actionBtn} onPress={() => handleCopy(c.value)}>
                          <Ionicons name="copy-outline" size={18} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                    );
                  }
                  return null;
                }}
              />
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = (colors: ReturnType<typeof useColors>, radius: number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground, fontFamily: 'Inter_700Bold' },
  lockBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.muted, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  lockText: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
  authArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  bioBtn: { marginTop: 28, alignItems: 'center', gap: 8 },
  bioText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  emptyVault: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
  emptySub: { fontSize: 14, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 21 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 20, marginBottom: 8, marginHorizontal: 16 },
  emptyText: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontStyle: 'italic', paddingHorizontal: 16, marginBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius, borderWidth: 1, marginHorizontal: 16, marginBottom: 6 },
  itemIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  catDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  itemLabel: { fontSize: 14, fontWeight: '500', color: colors.foreground, fontFamily: 'Inter_500Medium' },
  itemMeta: { fontSize: 11, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 1 },
  itemValue: { fontSize: 13, color: colors.foreground, fontFamily: 'Inter_400Regular', marginTop: 1 },
  actionBtn: { padding: 8 },
});
