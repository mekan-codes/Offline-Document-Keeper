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
import { exportBackup, previewBackup, importBackup, clearAllData, BackupValidationError } from '@/storage/db';
import { verifyPin } from '@/storage/pinUtils';

type PINMode = 'setup' | 'change-old' | 'change-new' | 'disable' | 'delete-confirm' | null;

export default function SettingsTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, refreshSettings, resetSettingsState } = useSettings();
  const { isPinSetup, setupPin, changePin, disablePin, hasBiometrics, resetLockState } = useAppLock();
  const { files, refreshFiles } = useVault();
  const { cards, refreshCards } = useInfo();
  const { kits, refreshKits } = useKits();
  const [pinMode, setPinMode] = useState<PINMode>(null);
  const [newPinBuffer, setNewPinBuffer] = useState('');
  const [pinModalError, setPinModalError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const s = styles(colors, colors.radius);

  const doDeleteAll = async () => {
    await clearAllData(true);
    await resetLockState();
    resetSettingsState();
    await refreshFiles(); await refreshCards(); await refreshKits();
    Alert.alert('Deleted', 'All data and files have been permanently removed.');
  };

  const handlePinComplete = async (pin: string) => {
    setPinModalError(null);
    if (pinMode === 'setup') {
      await setupPin(pin);
      await updateSettings({ pinEnabled: true });
      setPinMode(null);
      Alert.alert('PIN Set', 'Your vault is now protected with a PIN.');
    } else if (pinMode === 'change-old') {
      setNewPinBuffer(pin);
      setPinMode('change-new');
    } else if (pinMode === 'change-new') {
      const ok = await changePin(newPinBuffer, pin);
      if (ok) { Alert.alert('Done', 'PIN changed successfully.'); setPinMode(null); }
      else setPinModalError('Old PIN was incorrect');
    } else if (pinMode === 'disable') {
      const ok = await disablePin(pin);
      if (ok) { await updateSettings({ pinEnabled: false, biometricEnabled: false }); setPinMode(null); Alert.alert('PIN Removed', 'Your vault is no longer PIN-protected.'); }
      else setPinModalError('Incorrect PIN');
    } else if (pinMode === 'delete-confirm') {
      const ok = await verifyPin(pin);
      if (ok) {
        setPinMode(null);
        await doDeleteAll();
      } else {
        setPinModalError('Incorrect PIN — deletion cancelled');
      }
    }
  };

  const handleExportBackup = async () => {
    try {
      const json = await exportBackup();
      const fn = `docpocket_backup_${new Date().toISOString().split('T')[0]}.json`;
      const path = (FileSystem as any).cacheDirectory + fn;
      await FileSystem.writeAsStringAsync(path, json);
      if (Platform.OS === 'web') { Alert.alert('Backup', 'Backup created (sharing not available on web)'); return; }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Save DocPocket Backup' });
        await updateSettings({ lastBackupDate: new Date().toISOString() });
      }
    } catch {
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

      let preview;
      try { preview = await previewBackup(json); }
      catch (err) {
        const msg = err instanceof BackupValidationError ? err.message : 'This file is not a valid DocPocket backup.';
        Alert.alert('Invalid Backup', `${msg}\n\nYour data was not changed.`);
        setImporting(false);
        return;
      }

      Alert.alert(
        'Import Backup?',
        `Found:\n• ${preview.fileCount} file records\n• ${preview.infoCardCount} info cards\n• ${preview.kitCount} kits${preview.hasSettings ? '\n• Settings' : ''}\n\nExported: ${preview.exportedAt ? new Date(preview.exportedAt).toLocaleDateString() : 'Unknown'}\n\nThis backup saves info cards, kits, and file metadata, but not actual document files.\n\nThis will replace your current data.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setImporting(false) },
          { text: 'Import', style: 'destructive', onPress: async () => {
            try {
              const result = await importBackup(json);
              await refreshFiles(); await refreshCards(); await refreshKits();
              if (result.hasSettings) await refreshSettings();
              Alert.alert('Import Complete', `Restored:\n• ${result.fileCount} file records\n• ${result.infoCardCount} info cards\n• ${result.kitCount} kits`);
            } catch (err) {
              const msg = err instanceof BackupValidationError ? err.message : 'Backup data is corrupted.';
              Alert.alert('Import Failed', `${msg}\n\nYour original data was not changed.`);
            } finally { setImporting(false); }
          }},
        ]
      );
    } catch { Alert.alert('Error', 'Could not read backup file'); setImporting(false); }
  };

  const handleDeleteAll = () => {
    if (isPinSetup && settings.pinEnabled) {
      Alert.alert(
        'Delete All Data',
        'Enter your PIN to confirm permanent deletion of all files and data. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', style: 'destructive', onPress: () => {
            setPinModalError(null);
            setPinMode('delete-confirm');
          }},
        ]
      );
    } else {
      Alert.alert(
        'Delete All Data',
        'This will permanently delete ALL files, info cards, kits, and settings. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete Everything', style: 'destructive', onPress: doDeleteAll },
        ]
      );
    }
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

  const Row = ({ icon, label, sub, onPress, destructive, right, iconColor }: { icon: string; label: string; sub?: string; onPress?: () => void; destructive?: boolean; right?: React.ReactNode; iconColor?: string }) => (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={onPress ? 0.6 : 1}>
      <Ionicons name={icon as any} size={20} color={iconColor || (destructive ? colors.destructive : colors.primary)} style={s.rowIcon} />
      <View style={s.rowBody}>
        <Text style={[s.rowLabel, destructive && { color: colors.destructive }]}>{label}</Text>
        {sub && <Text style={s.rowSub}>{sub}</Text>}
      </View>
      {right || (onPress && !right && <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />)}
    </TouchableOpacity>
  );

  const Divider = () => <View style={[s.divider, { backgroundColor: colors.border }]} />;

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

        <Section title="Security">
          <ToggleRow
            label="PIN Lock"
            sub={isPinSetup && settings.pinEnabled ? 'Vault is protected' : 'Set up a PIN to lock your vault'}
            value={isPinSetup && settings.pinEnabled}
            onToggle={() => {
              if (!isPinSetup || !settings.pinEnabled) { setPinModalError(null); setPinMode('setup'); }
              else setPinMode('disable');
            }}
          />
          {isPinSetup && settings.pinEnabled && (
            <>
              <Divider />
              <Row icon="key-outline" label="Change PIN" onPress={() => { setPinModalError(null); setNewPinBuffer(''); setPinMode('change-old'); }} />
            </>
          )}
          {hasBiometrics && isPinSetup && settings.pinEnabled && (
            <>
              <Divider />
              <ToggleRow
                label="Biometric Unlock"
                sub="Use fingerprint or Face ID to unlock"
                value={settings.biometricEnabled}
                onToggle={() => updateSettings({ biometricEnabled: !settings.biometricEnabled })}
              />
            </>
          )}
          <Divider />
          <ToggleRow
            label="Privacy Mode"
            sub="Hides sensitive files from Vault; masks values globally"
            value={settings.privacyMode}
            onToggle={() => updateSettings({ privacyMode: !settings.privacyMode })}
          />
          <Divider />
          <ToggleRow
            label="Auto-clear Clipboard"
            sub={settings.clearClipboardAfterSeconds > 0
              ? `Clears after ${settings.clearClipboardAfterSeconds}s when copying sensitive info`
              : 'Clipboard is not auto-cleared'}
            value={settings.clearClipboardAfterSeconds > 0}
            onToggle={() => updateSettings({ clearClipboardAfterSeconds: settings.clearClipboardAfterSeconds > 0 ? 0 : 60 })}
          />
        </Section>

        <Section title="Auto-lock">
          {[
            { label: 'Immediately on background', value: 0 },
            { label: 'After 1 minute', value: 1 },
            { label: 'After 5 minutes', value: 5 },
            { label: 'After 15 minutes', value: 15 },
          ].map((opt, i) => (
            <React.Fragment key={opt.value}>
              {i > 0 && <Divider />}
              <TouchableOpacity style={s.row} onPress={() => updateSettings({ autoLockMinutes: opt.value })}>
                <Ionicons name="time-outline" size={20} color={colors.primary} style={s.rowIcon} />
                <Text style={[s.rowLabel, { flex: 1 }]}>{opt.label}</Text>
                {settings.autoLockMinutes === opt.value && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </Section>

        <Section title="Theme">
          {([
            { key: 'system', label: 'System', icon: 'contrast-outline' },
            { key: 'light', label: 'Light', icon: 'sunny-outline' },
            { key: 'dark', label: 'Dark', icon: 'moon-outline' },
          ] as const).map((t, i) => (
            <React.Fragment key={t.key}>
              {i > 0 && <Divider />}
              <TouchableOpacity style={s.row} onPress={() => updateSettings({ themePreference: t.key })}>
                <Ionicons name={t.icon} size={20} color={colors.primary} style={s.rowIcon} />
                <Text style={[s.rowLabel, { flex: 1 }]}>{t.label}</Text>
                {settings.themePreference === t.key && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </Section>

        <Section title="Expiry Alert Threshold">
          <View style={[s.infoBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
            <Text style={s.infoText}>
              Mark documents as expiring soon before this many days. If set to 60 days, a passport expiring within 60 days will show Expiring Soon.
            </Text>
          </View>
          <Divider />
          {[30, 60, 90, 180].map((days, i) => (
            <React.Fragment key={days}>
              {i > 0 && <Divider />}
              <TouchableOpacity style={s.row} onPress={() => updateSettings({ expiryWarningDays: days })}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} style={s.rowIcon} />
                <Text style={[s.rowLabel, { flex: 1 }]}>{days} days before expiry</Text>
                {settings.expiryWarningDays === days && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </Section>

        <Section title="Metadata Backup">
          <View style={[s.infoBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
            <Text style={s.infoText}>
              This backup saves info cards, kits, and file metadata, but not actual document files.
              Re-import documents manually after restoring.
            </Text>
          </View>
          <Divider />
          <Row icon="archive-outline" label="Export Metadata Backup" sub="Share a JSON backup of cards, kits, and metadata" onPress={handleExportBackup} />
          <Divider />
          <Row
            icon="folder-open-outline"
            label="Import Backup"
            sub={importing ? 'Reading backup file...' : 'Restore from a previous backup'}
            onPress={importing ? undefined : handleImportBackup}
            right={importing ? <ActivityIndicator color={colors.primary} size="small" /> : undefined}
          />
          {settings.lastBackupDate && (
            <>
              <Divider />
              <View style={s.row}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#10B981" style={s.rowIcon} />
                <Text style={[s.rowSub, { color: colors.mutedForeground }]}>
                  Last backup: {new Date(settings.lastBackupDate).toLocaleDateString()}
                </Text>
              </View>
            </>
          )}
        </Section>

        <Section title="Storage">
          {[
            { icon: 'document-outline', label: 'Files', value: files.length },
            { icon: 'card-outline', label: 'Info Cards', value: cards.length },
            { icon: 'briefcase-outline', label: 'Kits', value: kits.length },
          ].map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <Divider />}
              <View style={s.row}>
                <Ionicons name={item.icon as any} size={20} color={colors.primary} style={s.rowIcon} />
                <Text style={[s.rowLabel, { flex: 1 }]}>{item.label}</Text>
                <Text style={[s.rowSub, { color: colors.mutedForeground }]}>{item.value}</Text>
              </View>
            </React.Fragment>
          ))}
        </Section>

        <Section title="About">
          <View style={s.row}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} style={s.rowIcon} />
            <View style={s.rowBody}>
              <Text style={s.rowLabel}>DocPocket v1.0</Text>
              <Text style={s.rowSub}>100% offline · No cloud · No accounts · No tracking</Text>
            </View>
          </View>
        </Section>

        <Section title="Danger Zone">
          <Row
            icon="trash-outline"
            label="Delete All Data"
            sub="Permanently removes all files, cards, kits, and settings. Requires PIN if PIN is enabled."
            destructive
            onPress={handleDeleteAll}
          />
        </Section>

        <View style={{ height: 120 }} />
      </ScrollView>

      <Modal visible={pinMode !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setPinMode(null); setPinModalError(null); }}>
        <View style={[s.pinModal, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40, backgroundColor: colors.background }]}>
          <TouchableOpacity style={s.pinClose} onPress={() => { setPinMode(null); setPinModalError(null); }}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <PINPad
            title={
              pinMode === 'setup' ? 'Set PIN' :
              pinMode === 'change-old' ? 'Current PIN' :
              pinMode === 'change-new' ? 'New PIN' :
              pinMode === 'delete-confirm' ? 'Confirm Deletion' :
              'Enter PIN to Disable'
            }
            subtitle={
              pinMode === 'setup' ? 'Choose a 6-digit PIN to protect your vault' :
              pinMode === 'change-old' ? 'Enter your current PIN first' :
              pinMode === 'change-new' ? 'Enter your new 6-digit PIN' :
              pinMode === 'delete-confirm' ? 'Enter your PIN to permanently delete all data' :
              undefined
            }
            onComplete={handlePinComplete}
            error={pinModalError}
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
  divider: { height: 1, marginLeft: 56 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  toggleInfo: { flex: 1 },
  settingLabel: { fontSize: 15, color: colors.foreground, fontFamily: 'Inter_500Medium' },
  settingSub: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 },
  toggle: { width: 44, height: 24, borderRadius: 12, justifyContent: 'center', flexShrink: 0 },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', elevation: 2 },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, margin: 12, borderRadius: 8, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  pinModal: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pinClose: { position: 'absolute', top: 20, right: 20 },
});
