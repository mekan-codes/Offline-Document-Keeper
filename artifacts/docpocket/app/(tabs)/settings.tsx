import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useColors } from '@/hooks/useColors';
import { useSettings } from '@/contexts/SettingsContext';
import { useAppLock } from '@/contexts/AppLockContext';
import { useVault } from '@/contexts/VaultContext';
import { useInfo } from '@/contexts/InfoContext';
import { useKits } from '@/contexts/KitsContext';
import { PINPad } from '@/components/PINPad';
import { exportBackup, importBackup, clearAllData } from '@/storage/db';

type PINMode = 'setup' | 'change-old' | 'change-new' | 'disable' | 'confirm-delete' | null;

export default function SettingsTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useSettings();
  const { isPinSetup, setupPin, changePin, disablePin, pinError, clearPinError, hasBiometrics } = useAppLock();
  const { files, refreshFiles } = useVault();
  const { cards, refreshCards } = useInfo();
  const { kits, refreshKits } = useKits();
  const [pinMode, setPinMode] = useState<PINMode>(null);
  const [newPinBuffer, setNewPinBuffer] = useState('');
  const [pinModalError, setPinModalError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const s = styles(colors, colors.radius);

  const handlePinComplete = async (pin: string) => {
    setPinModalError(null);
    if (pinMode === 'setup') {
      await setupPin(pin);
      await updateSettings({ pinEnabled: true });
      setPinMode(null);
    } else if (pinMode === 'change-old') {
      setNewPinBuffer(pin);
      setPinMode('change-new');
    } else if (pinMode === 'change-new') {
      const ok = await changePin(newPinBuffer, pin);
      if (ok) { Alert.alert('Done', 'PIN changed successfully'); setPinMode(null); }
      else setPinModalError('Old PIN was incorrect');
    } else if (pinMode === 'disable') {
      const ok = await disablePin(pin);
      if (ok) { await updateSettings({ pinEnabled: false, biometricEnabled: false }); setPinMode(null); }
      else setPinModalError('Incorrect PIN');
    } else if (pinMode === 'confirm-delete') {
      const stored = await (async () => {
        try {
          const SecureStore = await import('expo-secure-store');
          return await SecureStore.getItemAsync('docpocket_pin_hash');
        } catch { return null; }
      })();
      const hash = 'h' + Math.abs(pin.split('').reduce((h, c) => { const v = c.charCodeAt(0); return ((h << 5) - h + v) | 0; }, 0)).toString(16) + pin.length.toString();
      if (!stored || stored === hash) {
        Alert.alert('Delete All Data', 'This will permanently delete all files, info cards, and kits.', [
          { text: 'Cancel', style: 'cancel', onPress: () => setPinMode(null) },
          {
            text: 'Delete Everything', style: 'destructive', onPress: async () => {
              await clearAllData();
              await refreshFiles(); await refreshCards(); await refreshKits();
              setPinMode(null);
              Alert.alert('Done', 'All data has been deleted');
            }
          }
        ]);
      } else {
        setPinModalError('Incorrect PIN');
      }
    }
  };

  const handleExportBackup = async () => {
    try {
      const json = await exportBackup();
      const fn = `docpocket_backup_${new Date().toISOString().split('T')[0]}.json`;
      const path = FileSystem.cacheDirectory + fn;
      await FileSystem.writeAsStringAsync(path, json);
      if (Platform.OS === 'web') { Alert.alert('Backup', 'Backup created (sharing not available on web)'); return; }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Save DocPocket Backup' });
        await updateSettings({ lastBackupDate: new Date().toISOString() });
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to export backup');
    }
  };

  const handleImportBackup = async () => {
    if (Platform.OS === 'web') { Alert.alert('Not supported', 'Import is not available on web'); return; }
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (res.canceled) return;
      setImporting(true);
      const json = await FileSystem.readAsStringAsync(res.assets[0].uri);
      const counts = await importBackup(json);
      await refreshFiles(); await refreshCards(); await refreshKits();
      Alert.alert('Import Complete', `Imported ${counts.files} files, ${counts.infoCards} info cards, ${counts.kits} kits`);
    } catch (e) {
      Alert.alert('Import Failed', 'The backup file appears to be invalid or corrupted. Your current data is unchanged.');
    } finally { setImporting(false); }
  };

  const ToggleRow = ({ label, sub, value, onToggle, color }: { label: string; sub?: string; value: boolean; onToggle: () => void; color?: string }) => (
    <View style={s.toggleRow}>
      <View style={s.toggleInfo}>
        <Text style={s.settingLabel}>{label}</Text>
        {sub && <Text style={s.settingSub}>{sub}</Text>}
      </View>
      <TouchableOpacity style={[s.toggle, { backgroundColor: value ? (color || colors.primary) : colors.muted }]} onPress={onToggle}>
        <View style={[s.toggleKnob, { marginLeft: value ? 20 : 2 }]} />
      </TouchableOpacity>
    </View>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={[s.sectionBody, { backgroundColor: colors.card, borderColor: colors.border }]}>{children}</View>
    </View>
  );

  const Row = ({ icon, label, sub, onPress, destructive, right }: { icon: string; label: string; sub?: string; onPress?: () => void; destructive?: boolean; right?: React.ReactNode }) => (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={onPress ? 0.6 : 1}>
      <Ionicons name={icon as any} size={20} color={destructive ? colors.destructive : colors.primary} style={s.rowIcon} />
      <View style={s.rowBody}>
        <Text style={[s.rowLabel, destructive && { color: colors.destructive }]}>{label}</Text>
        {sub && <Text style={s.rowSub}>{sub}</Text>}
      </View>
      {right || (onPress && <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />)}
    </TouchableOpacity>
  );

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        <Section title="Security">
          <ToggleRow
            label="PIN Lock"
            sub={isPinSetup ? 'Enabled' : 'Set up a PIN to protect your vault'}
            value={settings.pinEnabled && isPinSetup}
            onToggle={() => {
              if (!isPinSetup || !settings.pinEnabled) setPinMode('setup');
              else setPinMode('disable');
            }}
          />
          {isPinSetup && settings.pinEnabled && (
            <Row icon="key-outline" label="Change PIN" onPress={() => { setNewPinBuffer(''); setPinMode('change-old'); }} />
          )}
          {hasBiometrics && isPinSetup && settings.pinEnabled && (
            <ToggleRow
              label="Biometric Unlock"
              sub="Use fingerprint or face ID"
              value={settings.biometricEnabled}
              onToggle={() => updateSettings({ biometricEnabled: !settings.biometricEnabled })}
            />
          )}
          <View style={s.rowDivider} />
          <ToggleRow
            label="Privacy Mode"
            sub="Masks sensitive values and files"
            value={settings.privacyMode}
            onToggle={() => updateSettings({ privacyMode: !settings.privacyMode })}
          />
          <ToggleRow
            label="Auto-clear Clipboard"
            sub={`Clear after ${settings.clearClipboardAfterSeconds}s when copying sensitive info`}
            value={settings.clearClipboardAfterSeconds > 0}
            onToggle={() => updateSettings({ clearClipboardAfterSeconds: settings.clearClipboardAfterSeconds > 0 ? 0 : 60 })}
          />
        </Section>

        <Section title="Auto-lock">
          {[
            { label: 'Immediately', value: 0 },
            { label: 'After 1 minute', value: 1 },
            { label: 'After 5 minutes', value: 5 },
            { label: 'After 15 minutes', value: 15 },
          ].map(opt => (
            <TouchableOpacity key={opt.value} style={s.row} onPress={() => updateSettings({ autoLockMinutes: opt.value })}>
              <Ionicons name="time-outline" size={20} color={colors.primary} style={s.rowIcon} />
              <Text style={s.rowLabel}>{opt.label}</Text>
              {settings.autoLockMinutes === opt.value && <Ionicons name="checkmark" size={20} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </Section>

        <Section title="Appearance">
          {(['system', 'light', 'dark'] as const).map(t => (
            <TouchableOpacity key={t} style={s.row} onPress={() => updateSettings({ themePreference: t })}>
              <Ionicons name={t === 'system' ? 'contrast-outline' : t === 'light' ? 'sunny-outline' : 'moon-outline'} size={20} color={colors.primary} style={s.rowIcon} />
              <Text style={s.rowLabel}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
              {settings.themePreference === t && <Ionicons name="checkmark" size={20} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </Section>

        <Section title="Expiry Warnings">
          {[30, 60, 90, 180].map(days => (
            <TouchableOpacity key={days} style={s.row} onPress={() => updateSettings({ expiryWarningDays: days })}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} style={s.rowIcon} />
              <Text style={s.rowLabel}>{days} days before expiry</Text>
              {settings.expiryWarningDays === days && <Ionicons name="checkmark" size={20} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </Section>

        <Section title="Backup">
          <Row icon="cloud-upload-outline" label="Export Backup" sub="Save a JSON backup of all your data" onPress={handleExportBackup} />
          <Row icon="cloud-download-outline" label="Import Backup" sub={importing ? 'Importing...' : 'Restore from a backup file'} onPress={importing ? undefined : handleImportBackup}
            right={importing ? <ActivityIndicator color={colors.primary} size="small" /> : undefined} />
          {settings.lastBackupDate && (
            <View style={s.row}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#10B981" style={s.rowIcon} />
              <Text style={[s.rowSub, { color: colors.mutedForeground }]}>Last backup: {new Date(settings.lastBackupDate).toLocaleDateString()}</Text>
            </View>
          )}
        </Section>

        <Section title="Storage">
          {[
            { icon: 'document-outline', label: 'Files', value: files.length.toString() },
            { icon: 'card-outline', label: 'Info Cards', value: cards.length.toString() },
            { icon: 'briefcase-outline', label: 'Kits', value: kits.length.toString() },
          ].map((item, i) => (
            <View key={i} style={s.row}>
              <Ionicons name={item.icon as any} size={20} color={colors.primary} style={s.rowIcon} />
              <Text style={[s.rowLabel, { flex: 1 }]}>{item.label}</Text>
              <Text style={[s.rowSub, { color: colors.mutedForeground }]}>{item.value}</Text>
            </View>
          ))}
        </Section>

        <Section title="About">
          <View style={s.row}>
            <Ionicons name="information-circle-outline" size={20} color={colors.primary} style={s.rowIcon} />
            <View style={s.rowBody}>
              <Text style={s.rowLabel}>DocPocket v1.0</Text>
              <Text style={s.rowSub}>100% offline — no cloud, no accounts, no tracking</Text>
            </View>
          </View>
        </Section>

        <Section title="Danger Zone">
          <Row
            icon="trash-outline"
            label="Delete All Data"
            sub="Permanently remove all files, cards, and kits"
            destructive
            onPress={() => {
              if (isPinSetup && settings.pinEnabled) setPinMode('confirm-delete');
              else Alert.alert('Delete All Data', 'This will permanently delete everything.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: async () => { await clearAllData(); await refreshFiles(); await refreshCards(); await refreshKits(); } },
              ]);
            }}
          />
        </Section>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* PIN Modal */}
      <Modal visible={pinMode !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setPinMode(null); clearPinError(); setPinModalError(null); }}>
        <View style={[s.pinModal, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40, backgroundColor: colors.background }]}>
          <TouchableOpacity style={s.pinClose} onPress={() => { setPinMode(null); setPinModalError(null); }}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <PINPad
            title={
              pinMode === 'setup' ? 'Set PIN' :
              pinMode === 'change-old' ? 'Current PIN' :
              pinMode === 'change-new' ? 'New PIN' :
              pinMode === 'disable' ? 'Enter PIN to Disable' :
              'Confirm with PIN'
            }
            subtitle={
              pinMode === 'setup' ? 'Choose a 6-digit PIN to protect your vault' :
              pinMode === 'change-old' ? 'Enter your current PIN' :
              pinMode === 'change-new' ? 'Enter your new PIN' :
              pinMode === 'confirm-delete' ? 'Enter your PIN to confirm deletion' :
              undefined
            }
            onComplete={handlePinComplete}
            error={pinModalError || pinError}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>, radius: number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: colors.foreground, fontFamily: 'Inter_700Bold' },
  scrollContent: { paddingHorizontal: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingLeft: 4 },
  sectionBody: { borderRadius: radius, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowIcon: { width: 24, textAlign: 'center' },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: 15, color: colors.foreground, fontFamily: 'Inter_500Medium' },
  rowSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: 56 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  toggleInfo: { flex: 1 },
  settingLabel: { fontSize: 15, color: colors.foreground, fontFamily: 'Inter_500Medium' },
  settingSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  toggle: { width: 44, height: 24, borderRadius: 12, justifyContent: 'center', flexShrink: 0 },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', elevation: 2 },
  pinModal: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pinClose: { position: 'absolute', top: 20, right: 20 },
});
