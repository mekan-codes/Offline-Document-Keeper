import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useColors } from '@/hooks/useColors';
import { useSettings } from '@/contexts/SettingsContext';
import { useAppLock } from '@/contexts/AppLockContext';
import { useVault } from '@/contexts/VaultContext';
import { useInfo } from '@/contexts/InfoContext';
import { useKits } from '@/contexts/KitsContext';
import { PINPad } from '@/components/PINPad';
import {
  exportBackup,
  previewBackup,
  importBackup,
  clearAllData,
  BackupValidationError,
} from '@/storage/db';
import { verifyPin } from '@/storage/pinUtils';
import { formatStoredDate } from '@/utils/date';

type PINMode =
  | 'setup'
  | 'setup-confirm'
  | 'change-old'
  | 'change-new'
  | 'change-confirm'
  | 'reset-new'
  | 'reset-confirm'
  | 'disable'
  | 'delete-confirm'
  | null;

export default function SettingsTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, refreshSettings, resetSettingsState } = useSettings();
  const {
    isPinSetup,
    setupPin,
    changePin,
    disablePin,
    hasBiometrics,
    resetLockState,
    authenticateWithBiometrics,
  } = useAppLock();
  const { files, refreshFiles } = useVault();
  const { cards, refreshCards } = useInfo();
  const { kits, refreshKits } = useKits();
  const [pinMode, setPinMode] = useState<PINMode>(null);
  const [currentPinBuffer, setCurrentPinBuffer] = useState('');
  const [newPinBuffer, setNewPinBuffer] = useState('');
  const [pinModalError, setPinModalError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const s = styles(colors, colors.radius);

  const closePinModal = () => {
    setPinMode(null);
    setPinModalError(null);
    setCurrentPinBuffer('');
    setNewPinBuffer('');
  };

  const doDeleteAll = async () => {
    await clearAllData(true);
    await resetLockState();
    resetSettingsState();
    await refreshFiles();
    await refreshCards();
    await refreshKits();
    Alert.alert('Deleted', 'All data and files have been permanently removed.');
  };

  const handlePinComplete = async (pin: string) => {
    setPinModalError(null);

    if (pinMode === 'setup') {
      setNewPinBuffer(pin);
      setPinMode('setup-confirm');
      return;
    }

    if (pinMode === 'setup-confirm') {
      if (pin !== newPinBuffer) {
        setNewPinBuffer('');
        setPinMode('setup');
        setPinModalError('PINs did not match. Try again.');
        return;
      }
      await setupPin(pin);
      await updateSettings({ pinEnabled: true });
      closePinModal();
      Alert.alert('PIN Set', 'Your vault is now protected with a PIN.');
      return;
    }

    if (pinMode === 'change-old') {
      const ok = await verifyPin(pin);
      if (!ok) {
        setPinModalError('Current PIN was incorrect.');
        return;
      }
      setCurrentPinBuffer(pin);
      setPinMode('change-new');
      return;
    }

    if (pinMode === 'change-new') {
      setNewPinBuffer(pin);
      setPinMode('change-confirm');
      return;
    }

    if (pinMode === 'change-confirm') {
      if (pin !== newPinBuffer) {
        setNewPinBuffer('');
        setPinMode('change-new');
        setPinModalError('PINs did not match. Try again.');
        return;
      }
      const ok = await changePin(currentPinBuffer, pin);
      if (ok) {
        Alert.alert('Done', 'PIN changed successfully.');
        closePinModal();
      } else {
        setPinModalError('Current PIN was incorrect.');
      }
      return;
    }

    if (pinMode === 'reset-new') {
      setNewPinBuffer(pin);
      setPinMode('reset-confirm');
      return;
    }

    if (pinMode === 'reset-confirm') {
      if (pin !== newPinBuffer) {
        setNewPinBuffer('');
        setPinMode('reset-new');
        setPinModalError('PINs did not match. Try again.');
        return;
      }
      await setupPin(pin);
      await updateSettings({ pinEnabled: true });
      closePinModal();
      Alert.alert('PIN Reset', 'Your DocPocket PIN was reset.');
      return;
    }

    if (pinMode === 'disable') {
      const ok = await disablePin(pin);
      if (ok) {
        await updateSettings({ pinEnabled: false, biometricEnabled: false });
        closePinModal();
        Alert.alert('PIN Removed', 'Your vault is no longer PIN-protected.');
      } else {
        setPinModalError('Incorrect PIN');
      }
      return;
    }

    if (pinMode === 'delete-confirm') {
      const ok = await verifyPin(pin);
      if (ok) {
        closePinModal();
        await doDeleteAll();
      } else {
        setPinModalError('Incorrect PIN. Deletion cancelled.');
      }
    }
  };

  const openSetupPin = () => {
    setPinModalError(null);
    setCurrentPinBuffer('');
    setNewPinBuffer('');
    setPinMode('setup');
  };

  const openChangePin = () => {
    setPinModalError(null);
    setCurrentPinBuffer('');
    setNewPinBuffer('');
    setPinMode('change-old');
  };

  const handleResetPinWithBiometrics = async () => {
    if (!hasBiometrics || Platform.OS === 'web') {
      Alert.alert('Not available', 'Biometric verification is not available on this device.');
      return;
    }

    const ok = await authenticateWithBiometrics('Reset DocPocket PIN');
    if (!ok) {
      Alert.alert('Not verified', 'Biometric verification did not complete.');
      return;
    }

    setPinModalError(null);
    setCurrentPinBuffer('');
    setNewPinBuffer('');
    setPinMode('reset-new');
  };

  const handleBiometricToggle = async () => {
    if (settings.biometricEnabled) {
      await updateSettings({ biometricEnabled: false });
      return;
    }

    const ok = await authenticateWithBiometrics('Enable biometric unlock');
    if (!ok) {
      Alert.alert('Not enabled', 'Biometric verification did not complete.');
      return;
    }

    await updateSettings({ biometricEnabled: true });
  };

  const handleExportBackup = async () => {
    try {
      const json = await exportBackup();
      const filename = `docpocket_backup_${new Date().toISOString().split('T')[0]}.json`;
      const path = ((FileSystem as { cacheDirectory?: string }).cacheDirectory ?? '') + filename;
      await FileSystem.writeAsStringAsync(path, json);

      if (Platform.OS === 'web') {
        Alert.alert(
          'Backup created',
          'The metadata backup was generated, but sharing is not available on web.',
        );
        return;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Backup created', 'Sharing is not available on this device.');
        return;
      }

      await Sharing.shareAsync(path, {
        mimeType: 'application/json',
        dialogTitle: 'Save DocPocket Backup',
      });
      await updateSettings({ lastBackupDate: new Date().toISOString() });
    } catch {
      Alert.alert('Error', 'Failed to export backup');
    }
  };

  const handleImportBackup = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not supported', 'Import is not available on web');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      setImporting(true);
      const json = await FileSystem.readAsStringAsync(result.assets[0].uri);

      let preview;
      try {
        preview = await previewBackup(json);
      } catch (error) {
        const message =
          error instanceof BackupValidationError
            ? error.message
            : 'This file is not a valid DocPocket backup.';
        Alert.alert('Invalid Backup', `${message}\n\nYour data was not changed.`);
        setImporting(false);
        return;
      }

      const exportDateLabel = formatStoredDate(preview.exportedAt) ?? 'Unknown';
      const settingsLine = preview.hasSettings
        ? '\n- Settings (PIN and biometric unlock are reset for safety)'
        : '\n- Settings reset to defaults (backup has no settings block)';

      Alert.alert(
        'Import Backup?',
        `Found:\n- ${preview.fileCount} file records\n- ${preview.infoCardCount} info cards\n- ${preview.kitCount} kits${settingsLine}\n\nExported: ${exportDateLabel}\n\nThis backup restores info cards, kits, and file metadata only. Physical document files are not included, and device PIN/biometric secrets are not restored.\n\nThis will replace your current data.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setImporting(false),
          },
          {
            text: 'Import',
            style: 'destructive',
            onPress: async () => {
              try {
                const importResult = await importBackup(json);
                await refreshFiles();
                await refreshCards();
                await refreshKits();
                await refreshSettings();

                Alert.alert(
                  'Import Complete',
                  `Restored:\n- ${importResult.fileCount} file records\n- ${importResult.infoCardCount} info cards\n- ${importResult.kitCount} kits`,
                );
              } catch (error) {
                const message =
                  error instanceof BackupValidationError
                    ? error.message
                    : 'Backup data is corrupted.';
                Alert.alert('Import Failed', `${message}\n\nYour original data was not changed.`);
              } finally {
                setImporting(false);
              }
            },
          },
        ],
      );
    } catch {
      Alert.alert('Error', 'Could not read backup file');
      setImporting(false);
    }
  };

  const handleDeleteAll = () => {
    if (isPinSetup && settings.pinEnabled) {
      Alert.alert(
        'Delete All Data',
        'Enter your PIN to confirm permanent deletion of all files and data. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            style: 'destructive',
            onPress: () => {
              setPinModalError(null);
              setPinMode('delete-confirm');
            },
          },
        ],
      );
      return;
    }

    Alert.alert(
      'Delete All Data',
      'This will permanently delete all files, info cards, kits, and settings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: doDeleteAll,
        },
      ],
    );
  };

  const ToggleRow = ({
    label,
    sub,
    value,
    onToggle,
    color,
  }: {
    label: string;
    sub?: string;
    value: boolean;
    onToggle: () => void;
    color?: string;
  }) => (
    <View style={s.toggleRow}>
      <View style={s.toggleInfo}>
        <Text style={s.settingLabel}>{label}</Text>
        {sub && <Text style={s.settingSub}>{sub}</Text>}
      </View>
      <TouchableOpacity
        style={[
          s.toggle,
          { backgroundColor: value ? color || colors.primary : colors.muted },
        ]}
        onPress={onToggle}
      >
        <View style={[s.toggleKnob, { marginLeft: value ? 20 : 2 }]} />
      </TouchableOpacity>
    </View>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View
        style={[
          s.sectionBody,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {children}
      </View>
    </View>
  );

  const Row = ({
    icon,
    label,
    sub,
    onPress,
    destructive,
    right,
    iconColor,
  }: {
    icon: string;
    label: string;
    sub?: string;
    onPress?: () => void;
    destructive?: boolean;
    right?: React.ReactNode;
    iconColor?: string;
  }) => (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={onPress ? 0.6 : 1}>
      <Ionicons
        name={icon as never}
        size={20}
        color={iconColor || (destructive ? colors.destructive : colors.primary)}
        style={s.rowIcon}
      />
      <View style={s.rowBody}>
        <Text style={[s.rowLabel, destructive && { color: colors.destructive }]}>
          {label}
        </Text>
        {sub && <Text style={s.rowSub}>{sub}</Text>}
      </View>
      {right || (onPress && !right && (
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
      ))}
    </TouchableOpacity>
  );

  const Divider = () => <View style={[s.divider, { backgroundColor: colors.border }]} />;

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        <Section title="Security">
          <ToggleRow
            label="PIN Lock"
            sub={
              isPinSetup && settings.pinEnabled
                ? 'Vault is protected'
                : 'Set up a PIN to lock your vault'
            }
            value={isPinSetup && settings.pinEnabled}
            onToggle={() => {
              if (!isPinSetup || !settings.pinEnabled) {
                openSetupPin();
              } else {
                setPinMode('disable');
              }
            }}
          />
          {isPinSetup && settings.pinEnabled && (
            <>
              <Divider />
              <Row
                icon="key-outline"
                label="Change PIN"
                sub="Verify current PIN, then choose a new one"
                onPress={openChangePin}
              />
            </>
          )}
          {isPinSetup && settings.pinEnabled && hasBiometrics && Platform.OS !== 'web' && (
            <>
              <Divider />
              <Row
                icon="finger-print"
                label="Reset PIN with Biometrics"
                sub="Use device biometrics if you forgot the current PIN"
                onPress={handleResetPinWithBiometrics}
              />
            </>
          )}
          {hasBiometrics && isPinSetup && settings.pinEnabled && (
            <>
              <Divider />
              <ToggleRow
                label="Biometric Unlock"
                sub="Use fingerprint or Face ID to unlock"
                value={settings.biometricEnabled}
                onToggle={handleBiometricToggle}
              />
            </>
          )}
          <Divider />
          <ToggleRow
            label="Privacy Mode"
            sub="Hides sensitive files from Vault and masks private values"
            value={settings.privacyMode}
            onToggle={() => updateSettings({ privacyMode: !settings.privacyMode })}
          />
          <Divider />
          <ToggleRow
            label="Auto-clear Clipboard"
            sub={
              settings.clearClipboardAfterSeconds > 0
                ? `Clears after ${settings.clearClipboardAfterSeconds}s when copying sensitive info`
                : 'Clipboard is not auto-cleared'
            }
            value={settings.clearClipboardAfterSeconds > 0}
            onToggle={() =>
              updateSettings({
                clearClipboardAfterSeconds:
                  settings.clearClipboardAfterSeconds > 0 ? 0 : 60,
              })
            }
          />
        </Section>

        <Section title="Auto-lock">
          {[
            { label: 'Immediately on background', value: 0 },
            { label: 'After 1 minute', value: 1 },
            { label: 'After 5 minutes', value: 5 },
            { label: 'After 15 minutes', value: 15 },
          ].map((option, index) => (
            <React.Fragment key={option.value}>
              {index > 0 && <Divider />}
              <TouchableOpacity
                style={s.row}
                onPress={() => updateSettings({ autoLockMinutes: option.value })}
              >
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={colors.primary}
                  style={s.rowIcon}
                />
                <Text style={[s.rowLabel, { flex: 1 }]}>{option.label}</Text>
                {settings.autoLockMinutes === option.value && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </Section>

        <Section title="Theme">
          {([
            { key: 'system', label: 'System', icon: 'contrast-outline' },
            { key: 'light', label: 'Light', icon: 'sunny-outline' },
            { key: 'dark', label: 'Dark', icon: 'moon-outline' },
          ] as const).map((theme, index) => (
            <React.Fragment key={theme.key}>
              {index > 0 && <Divider />}
              <TouchableOpacity
                style={s.row}
                onPress={() => updateSettings({ themePreference: theme.key })}
              >
                <Ionicons
                  name={theme.icon}
                  size={20}
                  color={colors.primary}
                  style={s.rowIcon}
                />
                <Text style={[s.rowLabel, { flex: 1 }]}>{theme.label}</Text>
                {settings.themePreference === theme.key && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </Section>

        <Section title="Expiry Alert Threshold">
          <View style={[s.infoBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={colors.mutedForeground}
            />
            <Text style={s.infoText}>
              Mark documents as expiring soon before this many days. If set to 60 days,
              a passport expiring within 60 days will show Expiring Soon.
            </Text>
          </View>
          <Divider />
          {[30, 60, 90, 180].map((days, index) => (
            <React.Fragment key={days}>
              {index > 0 && <Divider />}
              <TouchableOpacity
                style={s.row}
                onPress={() => updateSettings({ expiryWarningDays: days })}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={colors.primary}
                  style={s.rowIcon}
                />
                <Text style={[s.rowLabel, { flex: 1 }]}>{days} days before expiry</Text>
                {settings.expiryWarningDays === days && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </Section>

        <Section title="Metadata Backup">
          <View style={[s.infoBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={colors.mutedForeground}
            />
            <Text style={s.infoText}>
              This backup saves info cards, kits, and file metadata only. Physical
              documents are not included, and PIN or biometric secrets are never restored.
            </Text>
          </View>
          <Divider />
          <Row
            icon="archive-outline"
            label="Export Metadata Backup"
            sub="Share a JSON backup of cards, kits, and metadata"
            onPress={handleExportBackup}
          />
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
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color="#10B981"
                  style={s.rowIcon}
                />
                <Text style={[s.rowSub, { color: colors.mutedForeground }]}>
                  Last backup: {formatStoredDate(settings.lastBackupDate) ?? 'Unknown'}
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
          ].map((item, index) => (
            <React.Fragment key={item.label}>
              {index > 0 && <Divider />}
              <View style={s.row}>
                <Ionicons
                  name={item.icon as never}
                  size={20}
                  color={colors.primary}
                  style={s.rowIcon}
                />
                <Text style={[s.rowLabel, { flex: 1 }]}>{item.label}</Text>
                <Text style={[s.rowSub, { color: colors.mutedForeground }]}>{item.value}</Text>
              </View>
            </React.Fragment>
          ))}
        </Section>

        <Section title="About">
          <View style={s.row}>
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={colors.primary}
              style={s.rowIcon}
            />
            <View style={s.rowBody}>
              <Text style={s.rowLabel}>DocPocket v1.0.1</Text>
              <Text style={s.rowSub}>100% offline | No cloud | No accounts | No tracking</Text>
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

      <Modal
        visible={pinMode !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePinModal}
      >
        <View
          style={[
            s.pinModal,
            {
              paddingTop: insets.top + 40,
              paddingBottom: insets.bottom + 40,
              backgroundColor: colors.background,
            },
          ]}
        >
          <TouchableOpacity style={s.pinClose} onPress={closePinModal}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <PINPad
            key={pinMode}
            title={
              pinMode === 'setup'
                ? 'Set PIN'
                : pinMode === 'setup-confirm'
                  ? 'Confirm PIN'
                : pinMode === 'change-old'
                  ? 'Current PIN'
                  : pinMode === 'change-new'
                    ? 'New PIN'
                    : pinMode === 'change-confirm'
                      ? 'Confirm New PIN'
                      : pinMode === 'reset-new'
                        ? 'New PIN'
                        : pinMode === 'reset-confirm'
                          ? 'Confirm New PIN'
                          : pinMode === 'delete-confirm'
                            ? 'Confirm Deletion'
                            : 'Enter PIN to Disable'
            }
            subtitle={
              pinMode === 'setup'
                ? 'Choose a 6-digit PIN just for DocPocket'
                : pinMode === 'setup-confirm'
                  ? 'Enter the same PIN again'
                : pinMode === 'change-old'
                  ? 'Enter your current PIN first'
                  : pinMode === 'change-new'
                    ? 'Enter your new 6-digit PIN'
                    : pinMode === 'change-confirm'
                      ? 'Enter the same new PIN again'
                      : pinMode === 'reset-new'
                        ? 'Choose a new 6-digit PIN'
                        : pinMode === 'reset-confirm'
                          ? 'Enter the same new PIN again'
                          : pinMode === 'delete-confirm'
                            ? 'Enter your PIN to permanently delete all data'
                            : undefined
            }
            onComplete={handlePinComplete}
            error={pinModalError}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>, radius: number) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8 },
    headerTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.foreground,
      fontFamily: 'Inter_700Bold',
    },
    scrollContent: { paddingHorizontal: 16 },
    section: { marginBottom: 24 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.mutedForeground,
      fontFamily: 'Inter_700Bold',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 8,
      paddingLeft: 4,
    },
    sectionBody: { borderRadius: radius, borderWidth: 1, overflow: 'hidden' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    rowIcon: { width: 24, textAlign: 'center' },
    rowBody: { flex: 1 },
    rowLabel: { fontSize: 15, color: colors.foreground, fontFamily: 'Inter_500Medium' },
    rowSub: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: 'Inter_400Regular',
      marginTop: 2,
    },
    divider: { height: 1, marginLeft: 56 },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    toggleInfo: { flex: 1 },
    settingLabel: { fontSize: 15, color: colors.foreground, fontFamily: 'Inter_500Medium' },
    settingSub: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: 'Inter_400Regular',
      marginTop: 2,
    },
    toggle: { width: 44, height: 24, borderRadius: 12, justifyContent: 'center', flexShrink: 0 },
    toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', elevation: 2 },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      padding: 12,
      margin: 12,
      borderRadius: 8,
      borderWidth: 1,
    },
    infoText: {
      flex: 1,
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: 'Inter_400Regular',
      lineHeight: 18,
    },
    pinModal: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    pinClose: { position: 'absolute', top: 20, right: 20 },
  });
