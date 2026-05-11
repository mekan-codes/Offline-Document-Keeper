import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import type { DocumentFile, InfoCard, Kit, AppSettings, ChecklistItem } from '@/types';

const KEYS = {
  FILES: 'docpocket_files',
  INFO_CARDS: 'docpocket_info_cards',
  KITS: 'docpocket_kits',
  SETTINGS: 'docpocket_settings',
};

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ─── Files ───────────────────────────────────────────────────────────────────

export async function getFiles(): Promise<DocumentFile[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.FILES);
    return raw ? (JSON.parse(raw) as DocumentFile[]) : [];
  } catch {
    return [];
  }
}

export async function saveFiles(files: DocumentFile[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.FILES, JSON.stringify(files));
}

export async function addFile(data: Omit<DocumentFile, 'id' | 'createdAt' | 'updatedAt'>): Promise<DocumentFile> {
  const files = await getFiles();
  const now = new Date().toISOString();
  const file: DocumentFile = { ...data, id: genId(), createdAt: now, updatedAt: now };
  await saveFiles([...files, file]);
  return file;
}

export async function updateFile(id: string, updates: Partial<DocumentFile>): Promise<void> {
  const files = await getFiles();
  const idx = files.findIndex(f => f.id === id);
  if (idx >= 0) {
    files[idx] = { ...files[idx], ...updates, updatedAt: new Date().toISOString() };
    await saveFiles(files);
  }
}

export async function deleteFile(id: string): Promise<void> {
  const files = await getFiles();
  await saveFiles(files.filter(f => f.id !== id));
}

// ─── Info Cards ──────────────────────────────────────────────────────────────

export async function getInfoCards(): Promise<InfoCard[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.INFO_CARDS);
    return raw ? (JSON.parse(raw) as InfoCard[]) : [];
  } catch {
    return [];
  }
}

export async function saveInfoCards(cards: InfoCard[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.INFO_CARDS, JSON.stringify(cards));
}

export async function addInfoCard(data: Omit<InfoCard, 'id' | 'createdAt' | 'updatedAt'>): Promise<InfoCard> {
  const cards = await getInfoCards();
  const now = new Date().toISOString();
  const card: InfoCard = { ...data, id: genId(), createdAt: now, updatedAt: now };
  await saveInfoCards([...cards, card]);
  return card;
}

export async function updateInfoCard(id: string, updates: Partial<InfoCard>): Promise<void> {
  const cards = await getInfoCards();
  const idx = cards.findIndex(c => c.id === id);
  if (idx >= 0) {
    cards[idx] = { ...cards[idx], ...updates, updatedAt: new Date().toISOString() };
    await saveInfoCards(cards);
  }
}

export async function deleteInfoCard(id: string): Promise<void> {
  const cards = await getInfoCards();
  await saveInfoCards(cards.filter(c => c.id !== id));
}

// ─── Kits ─────────────────────────────────────────────────────────────────────

export async function getKits(): Promise<Kit[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.KITS);
    return raw ? (JSON.parse(raw) as Kit[]) : [];
  } catch {
    return [];
  }
}

export async function saveKits(kits: Kit[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.KITS, JSON.stringify(kits));
}

export async function addKit(data: Omit<Kit, 'id' | 'createdAt' | 'updatedAt'>): Promise<Kit> {
  const kits = await getKits();
  const now = new Date().toISOString();
  const kit: Kit = { ...data, id: genId(), createdAt: now, updatedAt: now };
  await saveKits([...kits, kit]);
  return kit;
}

export async function updateKit(id: string, updates: Partial<Kit>): Promise<void> {
  const kits = await getKits();
  const idx = kits.findIndex(k => k.id === id);
  if (idx >= 0) {
    kits[idx] = { ...kits[idx], ...updates, updatedAt: new Date().toISOString() };
    await saveKits(kits);
  }
}

export async function deleteKit(id: string): Promise<void> {
  const kits = await getKits();
  await saveKits(kits.filter(k => k.id !== id));
}

export function makeChecklistItem(text: string): ChecklistItem {
  return { id: genId(), text, isDone: false };
}

// ─── Settings ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
  themePreference: 'system',
  pinEnabled: false,
  biometricEnabled: false,
  privacyMode: false,
  autoLockMinutes: 5,
  clearClipboardAfterSeconds: 60,
  expiryWarningDays: 60,
};

export async function getSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as AppSettings) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

// ─── Backup ───────────────────────────────────────────────────────────────────

export async function exportBackup(): Promise<string> {
  const [files, infoCards, kits, settings] = await Promise.all([
    getFiles(), getInfoCards(), getKits(), getSettings()
  ]);
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    note: 'This backup contains metadata only. Physical files are not included.',
    files,
    infoCards,
    kits,
    settings,
  }, null, 2);
}

export interface BackupPreview {
  fileCount: number;
  infoCardCount: number;
  kitCount: number;
  exportedAt: string;
  hasSettings: boolean;
}

export async function previewBackup(json: string): Promise<BackupPreview> {
  const data = JSON.parse(json);
  if (!data.version || !Array.isArray(data.files)) throw new Error('Invalid backup format');
  return {
    fileCount: Array.isArray(data.files) ? data.files.length : 0,
    infoCardCount: Array.isArray(data.infoCards) ? data.infoCards.length : 0,
    kitCount: Array.isArray(data.kits) ? data.kits.length : 0,
    exportedAt: data.exportedAt || 'Unknown',
    hasSettings: Boolean(data.settings),
  };
}

export async function importBackup(json: string): Promise<BackupPreview> {
  const data = JSON.parse(json);
  if (!data.version || !Array.isArray(data.files)) throw new Error('Invalid backup format');
  await Promise.all([
    saveFiles(data.files || []),
    saveInfoCards(data.infoCards || []),
    saveKits(data.kits || []),
    data.settings ? saveSettings({ ...DEFAULT_SETTINGS, ...data.settings }) : Promise.resolve(),
  ]);
  return {
    fileCount: data.files.length,
    infoCardCount: (data.infoCards || []).length,
    kitCount: (data.kits || []).length,
    exportedAt: data.exportedAt || '',
    hasSettings: Boolean(data.settings),
  };
}

// ─── Delete All ───────────────────────────────────────────────────────────────

export async function clearAllData(deletePhysicalFiles = true): Promise<void> {
  if (deletePhysicalFiles) {
    try {
      const dir = (FileSystem as any).documentDirectory + 'docpocket/';
      const info = await FileSystem.getInfoAsync(dir);
      if (info.exists) {
        await FileSystem.deleteAsync(dir, { idempotent: true });
      }
    } catch {}
  }
  await AsyncStorage.multiRemove([KEYS.FILES, KEYS.INFO_CARDS, KEYS.KITS, KEYS.SETTINGS]);
}
