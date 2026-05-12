import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import type { DocumentFile, InfoCard, Kit, AppSettings, ChecklistItem, RequiredItem } from '@/types';

const KEYS = {
  FILES: 'docpocket_files',
  INFO_CARDS: 'docpocket_info_cards',
  KITS: 'docpocket_kits',
  SETTINGS: 'docpocket_settings',
};

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeChecklistItems(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const text = typeof item.text === 'string' ? item.text : '';
    if (!text.trim()) return [];
    return [{
      id: typeof item.id === 'string' ? item.id : genId(),
      text,
      isDone: item.isDone === true,
    }];
  });
}

function normalizeRequiredItems(value: unknown): RequiredItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const label = typeof item.label === 'string' ? item.label : '';
    if (!label.trim()) return [];
    const requiredItem: RequiredItem = {
      id: typeof item.id === 'string' ? item.id : genId(),
      label,
      manuallyDone: item.manuallyDone === true,
    };
    if (typeof item.linkedFileId === 'string') requiredItem.linkedFileId = item.linkedFileId;
    if (typeof item.linkedInfoCardId === 'string') requiredItem.linkedInfoCardId = item.linkedInfoCardId;
    return [requiredItem];
  });
}

function normalizeKit(value: unknown): Kit {
  if (!isRecord(value)) throw new BackupValidationError('Backup contains a kit that is not an object.');
  const now = new Date().toISOString();
  const name = typeof value.name === 'string' && value.name.trim() ? value.name : 'Imported Kit';
  return {
    id: typeof value.id === 'string' ? value.id : genId(),
    name,
    color: typeof value.color === 'string' ? value.color : '#3B82F6',
    icon: typeof value.icon === 'string' ? value.icon : 'briefcase',
    fileIds: stringArray(value.fileIds),
    infoCardIds: stringArray(value.infoCardIds),
    checklistItems: normalizeChecklistItems(value.checklistItems),
    requiredItems: normalizeRequiredItems(value.requiredItems),
    requirementsNote: typeof value.requirementsNote === 'string' ? value.requirementsNote : '',
    note: typeof value.note === 'string' ? value.note : '',
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : now,
  };
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

export async function deleteFileAndCleanKits(id: string): Promise<void> {
  const files = await getFiles();
  const file = files.find(f => f.id === id);
  if (file?.localUri) {
    try {
      await FileSystem.deleteAsync(file.localUri, { idempotent: true });
    } catch {}
  }
  await saveFiles(files.filter(f => f.id !== id));
  const kits = await getKits();
  const updated = kits.map(k => ({
    ...k,
    fileIds: k.fileIds.filter(fid => fid !== id),
    requiredItems: (k.requiredItems || []).map(ri =>
      ri.linkedFileId === id ? { ...ri, linkedFileId: undefined } : ri
    ),
  }));
  await saveKits(updated);
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

export async function deleteInfoCardAndCleanKits(id: string): Promise<void> {
  await deleteInfoCard(id);
  const kits = await getKits();
  const updated = kits.map(k => ({
    ...k,
    infoCardIds: k.infoCardIds.filter(cid => cid !== id),
    requiredItems: (k.requiredItems || []).map(ri =>
      ri.linkedInfoCardId === id ? { ...ri, linkedInfoCardId: undefined } : ri
    ),
  }));
  await saveKits(updated);
}

// ─── Kits ─────────────────────────────────────────────────────────────────────

export async function getKits(): Promise<Kit[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.KITS);
    if (!raw) return [];
    const kits = JSON.parse(raw) as unknown;
    return Array.isArray(kits) ? kits.map(normalizeKit) : [];
  } catch {
    return [];
  }
}

export async function saveKits(kits: Kit[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.KITS, JSON.stringify(kits.map(normalizeKit)));
}

export async function addKit(data: Omit<Kit, 'id' | 'createdAt' | 'updatedAt'>): Promise<Kit> {
  const kits = await getKits();
  const now = new Date().toISOString();
  const kit: Kit = normalizeKit({
    ...data,
    fileIds: data.fileIds ?? [],
    infoCardIds: data.infoCardIds ?? [],
    checklistItems: data.checklistItems ?? [],
    requiredItems: data.requiredItems ?? [],
    requirementsNote: data.requirementsNote ?? '',
    note: data.note ?? '',
    id: genId(),
    createdAt: now,
    updatedAt: now,
  });
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

export function makeRequiredItem(label: string): RequiredItem {
  return { id: genId(), label, manuallyDone: false };
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

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

interface NormalizedBackup {
  version: unknown;
  files: DocumentFile[];
  infoCards: InfoCard[];
  kits: Kit[];
  settings?: AppSettings;
  exportedAt?: string;
}

function normalizeBackup(data: unknown): NormalizedBackup {
  if (!data || typeof data !== 'object') throw new BackupValidationError('Backup is not a valid JSON object.');
  const d = data as Record<string, unknown>;
  if (d.version === undefined || d.version === null) throw new BackupValidationError('Backup is missing a version field.');
  if (!Array.isArray(d.files)) throw new BackupValidationError('Backup "files" field is missing or not an array.');
  if (!Array.isArray(d.infoCards)) throw new BackupValidationError('Backup "infoCards" field is missing or not an array.');
  if (!Array.isArray(d.kits)) throw new BackupValidationError('Backup "kits" field is missing or not an array.');
  if (d.settings !== undefined && (!isRecord(d.settings))) {
    throw new BackupValidationError('Backup "settings" field is present but not a valid object.');
  }
  return {
    version: d.version,
    files: d.files as DocumentFile[],
    infoCards: d.infoCards as InfoCard[],
    kits: d.kits.map(normalizeKit),
    settings: d.settings ? { ...DEFAULT_SETTINGS, ...(d.settings as Partial<AppSettings>) } : undefined,
    exportedAt: typeof d.exportedAt === 'string' ? d.exportedAt : undefined,
  };
}

export async function previewBackup(json: string): Promise<BackupPreview> {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new BackupValidationError('File is not valid JSON.');
  }
  const backup = normalizeBackup(data);
  return {
    fileCount: backup.files.length,
    infoCardCount: backup.infoCards.length,
    kitCount: backup.kits.length,
    exportedAt: backup.exportedAt || 'Unknown',
    hasSettings: Boolean(backup.settings),
  };
}

export async function importBackup(json: string): Promise<BackupPreview> {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new BackupValidationError('File is not valid JSON.');
  }
  const backup = normalizeBackup(data);
  const entries: [string, string][] = [
    [KEYS.FILES, JSON.stringify(backup.files)],
    [KEYS.INFO_CARDS, JSON.stringify(backup.infoCards)],
    [KEYS.KITS, JSON.stringify(backup.kits)],
  ];
  if (backup.settings) entries.push([KEYS.SETTINGS, JSON.stringify(backup.settings)]);
  const current = await AsyncStorage.multiGet([KEYS.FILES, KEYS.INFO_CARDS, KEYS.KITS, KEYS.SETTINGS]);
  try {
    await AsyncStorage.multiSet(entries);
  } catch (error) {
    const restoreEntries = current.filter((entry): entry is [string, string] => entry[1] !== null);
    const removeKeys = current.filter((entry) => entry[1] === null).map(([key]) => key);
    if (restoreEntries.length > 0) await AsyncStorage.multiSet(restoreEntries);
    if (removeKeys.length > 0) await AsyncStorage.multiRemove(removeKeys);
    throw error;
  }
  return {
    fileCount: backup.files.length,
    infoCardCount: backup.infoCards.length,
    kitCount: backup.kits.length,
    exportedAt: backup.exportedAt || '',
    hasSettings: Boolean(backup.settings),
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
