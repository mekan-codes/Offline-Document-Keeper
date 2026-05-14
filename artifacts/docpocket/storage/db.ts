import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type {
  AppSettings,
  ChecklistItem,
  DocumentFile,
  InfoCard,
  Kit,
  RequiredItem,
} from '@/types';
import { parseStoredDate } from '@/utils/date';
import { ensureMissingLocalFileNote, hasLocalFile } from '@/utils/files';

const KEYS = {
  FILES: 'docpocket_files',
  INFO_CARDS: 'docpocket_info_cards',
  KITS: 'docpocket_kits',
  SETTINGS: 'docpocket_settings',
};

const FILE_CATEGORIES = new Set<DocumentFile['category']>([
  'identity',
  'visa',
  'travel',
  'school',
  'medical',
  'photos',
  'other',
]);

const INFO_CATEGORIES = new Set<InfoCard['category']>([
  'identity',
  'contact',
  'address',
  'school',
  'travel',
  'emergency',
  'custom',
]);

const DEFAULT_SETTINGS: AppSettings = {
  themePreference: 'system',
  pinEnabled: false,
  biometricEnabled: false,
  privacyMode: false,
  autoLockMinutes: 5,
  clearClipboardAfterSeconds: 60,
  expiryWarningDays: 60,
};

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function normalizeDateString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return parseStoredDate(value) ? value : undefined;
}

function isFileCategory(value: unknown): value is DocumentFile['category'] {
  return typeof value === 'string' && FILE_CATEGORIES.has(value as DocumentFile['category']);
}

function isInfoCategory(value: unknown): value is InfoCard['category'] {
  return typeof value === 'string' && INFO_CATEGORIES.has(value as InfoCard['category']);
}

function numberOrDefault(value: unknown, fallback: number, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    return fallback;
  }
  return value;
}

function normalizeChecklistItems(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];

    const text = typeof item.text === 'string' ? item.text.trim() : '';
    if (!text) return [];

    return [
      {
        id: typeof item.id === 'string' ? item.id : genId(),
        text,
        isDone: item.isDone === true,
      },
    ];
  });
}

function normalizeRequiredItems(value: unknown): RequiredItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];

    const label = typeof item.label === 'string' ? item.label.trim() : '';
    if (!label) return [];

    const requiredItem: RequiredItem = {
      id: typeof item.id === 'string' ? item.id : genId(),
      label,
      manuallyDone: item.manuallyDone === true,
    };

    if (typeof item.linkedFileId === 'string') requiredItem.linkedFileId = item.linkedFileId;
    if (typeof item.linkedInfoCardId === 'string') {
      requiredItem.linkedInfoCardId = item.linkedInfoCardId;
    }

    return [requiredItem];
  });
}

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

function normalizeKit(value: unknown): Kit {
  if (!isRecord(value)) {
    throw new BackupValidationError('Backup contains a kit that is not an object.');
  }

  const now = new Date().toISOString();
  const name =
    typeof value.name === 'string' && value.name.trim()
      ? value.name.trim()
      : 'Imported Kit';

  return {
    id: typeof value.id === 'string' ? value.id : genId(),
    name,
    color: typeof value.color === 'string' ? value.color : '#3B82F6',
    icon: typeof value.icon === 'string' ? value.icon : 'briefcase',
    fileIds: stringArray(value.fileIds),
    infoCardIds: stringArray(value.infoCardIds),
    checklistItems: normalizeChecklistItems(value.checklistItems),
    requiredItems: normalizeRequiredItems(value.requiredItems),
    requirementsNote:
      typeof value.requirementsNote === 'string' ? value.requirementsNote : '',
    note: typeof value.note === 'string' ? value.note : '',
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : now,
  };
}

function normalizeDocumentFile(value: unknown): DocumentFile | null {
  if (!isRecord(value)) return null;

  const now = new Date().toISOString();
  const name =
    typeof value.name === 'string' && value.name.trim()
      ? value.name.trim()
      : typeof value.originalFileName === 'string' && value.originalFileName.trim()
        ? value.originalFileName.trim()
        : 'Imported File';

  const originalFileName =
    typeof value.originalFileName === 'string' && value.originalFileName.trim()
      ? value.originalFileName.trim()
      : name;

  return {
    id: typeof value.id === 'string' ? value.id : genId(),
    name,
    originalFileName,
    localUri: typeof value.localUri === 'string' ? value.localUri : '',
    mimeType:
      typeof value.mimeType === 'string' && value.mimeType.trim()
        ? value.mimeType
        : 'application/octet-stream',
    sizeBytes: numberOrDefault(value.sizeBytes, 0),
    category: isFileCategory(value.category) ? value.category : 'other',
    tags: stringArray(value.tags),
    note: typeof value.note === 'string' ? value.note : '',
    requirementsNote:
      typeof value.requirementsNote === 'string' ? value.requirementsNote : '',
    expiryDate: normalizeDateString(value.expiryDate),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : now,
    lastOpenedAt: typeof value.lastOpenedAt === 'string' ? value.lastOpenedAt : undefined,
    lastSharedAt: typeof value.lastSharedAt === 'string' ? value.lastSharedAt : undefined,
    isFavorite: value.isFavorite === true,
    isSensitive: value.isSensitive === true,
  };
}

function normalizeInfoCard(value: unknown): InfoCard | null {
  if (!isRecord(value)) return null;

  const now = new Date().toISOString();
  const title =
    typeof value.title === 'string' && value.title.trim()
      ? value.title.trim()
      : 'Imported Info Card';

  return {
    id: typeof value.id === 'string' ? value.id : genId(),
    title,
    value: typeof value.value === 'string' ? value.value : '',
    category: isInfoCategory(value.category) ? value.category : 'custom',
    tags: stringArray(value.tags),
    isSensitive: value.isSensitive === true,
    isFavorite: value.isFavorite === true,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : now,
    lastCopiedAt: typeof value.lastCopiedAt === 'string' ? value.lastCopiedAt : undefined,
  };
}

function normalizeSettings(value: unknown): AppSettings {
  if (!isRecord(value)) return DEFAULT_SETTINGS;

  return {
    themePreference:
      value.themePreference === 'light' ||
      value.themePreference === 'dark' ||
      value.themePreference === 'system'
        ? value.themePreference
        : DEFAULT_SETTINGS.themePreference,
    pinEnabled: value.pinEnabled === true,
    biometricEnabled: value.biometricEnabled === true,
    privacyMode: value.privacyMode === true,
    autoLockMinutes: numberOrDefault(
      value.autoLockMinutes,
      DEFAULT_SETTINGS.autoLockMinutes,
    ),
    clearClipboardAfterSeconds: numberOrDefault(
      value.clearClipboardAfterSeconds,
      DEFAULT_SETTINGS.clearClipboardAfterSeconds,
    ),
    expiryWarningDays: numberOrDefault(
      value.expiryWarningDays,
      DEFAULT_SETTINGS.expiryWarningDays,
      1,
    ),
    lastBackupDate:
      typeof value.lastBackupDate === 'string' ? value.lastBackupDate : undefined,
  };
}

function sanitizeBackupSettings(settings: AppSettings | undefined): AppSettings | undefined {
  if (!settings) return undefined;

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    pinEnabled: false,
    biometricEnabled: false,
  };
}

async function sanitizeMissingLocalFiles(
  files: DocumentFile[],
  annotateMissing = false,
): Promise<{ files: DocumentFile[]; changed: boolean }> {
  let changed = false;

  const sanitized = await Promise.all(
    files.map(async (file) => {
      if (!hasLocalFile(file)) {
        if (!annotateMissing) return file;

        const nextNote = ensureMissingLocalFileNote(file.note);
        if (nextNote === file.note) return file;

        changed = true;
        return { ...file, note: nextNote };
      }

      try {
        const info = await FileSystem.getInfoAsync(file.localUri);
        if (info.exists) return file;
      } catch {}

      changed = true;
      return {
        ...file,
        localUri: '',
        lastOpenedAt: undefined,
        lastSharedAt: undefined,
        note: annotateMissing ? ensureMissingLocalFileNote(file.note) : file.note,
      };
    }),
  );

  return { files: sanitized, changed };
}

function sanitizeKitReferences(
  kits: Kit[],
  files: DocumentFile[],
  infoCards: InfoCard[],
): Kit[] {
  const fileIds = new Set(files.map((file) => file.id));
  const infoCardIds = new Set(infoCards.map((card) => card.id));

  return kits.map((kit) =>
    normalizeKit({
      ...kit,
      fileIds: kit.fileIds.filter((fileId) => fileIds.has(fileId)),
      infoCardIds: kit.infoCardIds.filter((cardId) => infoCardIds.has(cardId)),
      requiredItems: kit.requiredItems.map((item) => ({
        ...item,
        linkedFileId:
          item.linkedFileId && fileIds.has(item.linkedFileId)
            ? item.linkedFileId
            : undefined,
        linkedInfoCardId:
          item.linkedInfoCardId && infoCardIds.has(item.linkedInfoCardId)
            ? item.linkedInfoCardId
            : undefined,
      })),
    }),
  );
}

async function readStoredFiles(): Promise<DocumentFile[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.FILES);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const normalized = parsed.flatMap((item) => {
      const file = normalizeDocumentFile(item);
      return file ? [file] : [];
    });

    return normalized;
  } catch {
    return [];
  }
}

export async function getFiles(): Promise<DocumentFile[]> {
  const normalized = await readStoredFiles();
  const sanitized = await sanitizeMissingLocalFiles(normalized);
  if (sanitized.changed) {
    await saveFiles(sanitized.files);
  }

  return sanitized.files;
}

export async function saveFiles(files: DocumentFile[]): Promise<void> {
  const normalized = files.flatMap((file) => {
    const nextFile = normalizeDocumentFile(file);
    return nextFile ? [nextFile] : [];
  });

  await AsyncStorage.setItem(KEYS.FILES, JSON.stringify(normalized));
}

export async function addFile(
  data: Omit<DocumentFile, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<DocumentFile> {
  const files = await readStoredFiles();
  const now = new Date().toISOString();
  const file = normalizeDocumentFile({
    ...data,
    id: genId(),
    createdAt: now,
    updatedAt: now,
  });

  if (!file) {
    throw new Error('Failed to normalize file before saving.');
  }

  await saveFiles([...files, file]);
  return file;
}

export async function updateFile(
  id: string,
  updates: Partial<DocumentFile>,
): Promise<void> {
  const files = await readStoredFiles();
  const index = files.findIndex((file) => file.id === id);

  if (index >= 0) {
    const nextFile = normalizeDocumentFile({
      ...files[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    if (!nextFile) return;

    files[index] = nextFile;
    await saveFiles(files);
  }
}

export async function deleteFile(id: string): Promise<void> {
  const files = await readStoredFiles();
  await saveFiles(files.filter((file) => file.id !== id));
}

export async function deleteFileAndCleanKits(id: string): Promise<void> {
  const files = await readStoredFiles();
  const file = files.find((item) => item.id === id);

  if (file?.localUri) {
    try {
      await FileSystem.deleteAsync(file.localUri, { idempotent: true });
    } catch {}
  }

  await saveFiles(files.filter((item) => item.id !== id));

  const kits = await getKits();
  const updatedKits = kits.map((kit) => ({
    ...kit,
    fileIds: kit.fileIds.filter((fileId) => fileId !== id),
    requiredItems: kit.requiredItems.map((item) =>
      item.linkedFileId === id ? { ...item, linkedFileId: undefined } : item,
    ),
  }));

  await saveKits(updatedKits);
}

export async function getInfoCards(): Promise<InfoCard[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.INFO_CARDS);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((item) => {
      const card = normalizeInfoCard(item);
      return card ? [card] : [];
    });
  } catch {
    return [];
  }
}

export async function saveInfoCards(cards: InfoCard[]): Promise<void> {
  const normalized = cards.flatMap((card) => {
    const nextCard = normalizeInfoCard(card);
    return nextCard ? [nextCard] : [];
  });

  await AsyncStorage.setItem(KEYS.INFO_CARDS, JSON.stringify(normalized));
}

export async function addInfoCard(
  data: Omit<InfoCard, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<InfoCard> {
  const cards = await getInfoCards();
  const now = new Date().toISOString();
  const card = normalizeInfoCard({
    ...data,
    id: genId(),
    createdAt: now,
    updatedAt: now,
  });

  if (!card) {
    throw new Error('Failed to normalize info card before saving.');
  }

  await saveInfoCards([...cards, card]);
  return card;
}

export async function updateInfoCard(
  id: string,
  updates: Partial<InfoCard>,
): Promise<void> {
  const cards = await getInfoCards();
  const index = cards.findIndex((card) => card.id === id);

  if (index >= 0) {
    const nextCard = normalizeInfoCard({
      ...cards[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    if (!nextCard) return;

    cards[index] = nextCard;
    await saveInfoCards(cards);
  }
}

export async function deleteInfoCard(id: string): Promise<void> {
  const cards = await getInfoCards();
  await saveInfoCards(cards.filter((card) => card.id !== id));
}

export async function deleteInfoCardAndCleanKits(id: string): Promise<void> {
  await deleteInfoCard(id);

  const kits = await getKits();
  const updatedKits = kits.map((kit) => ({
    ...kit,
    infoCardIds: kit.infoCardIds.filter((cardId) => cardId !== id),
    requiredItems: kit.requiredItems.map((item) =>
      item.linkedInfoCardId === id
        ? { ...item, linkedInfoCardId: undefined }
        : item,
    ),
  }));

  await saveKits(updatedKits);
}

export async function getKits(): Promise<Kit[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.KITS);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.map(normalizeKit);
  } catch {
    return [];
  }
}

export async function saveKits(kits: Kit[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.KITS, JSON.stringify(kits.map(normalizeKit)));
}

export async function addKit(
  data: Omit<Kit, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Kit> {
  const kits = await getKits();
  const now = new Date().toISOString();

  const kit = normalizeKit({
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
  const index = kits.findIndex((kit) => kit.id === id);

  if (index >= 0) {
    kits[index] = normalizeKit({
      ...kits[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    await saveKits(kits);
  }
}

export async function deleteKit(id: string): Promise<void> {
  const kits = await getKits();
  await saveKits(kits.filter((kit) => kit.id !== id));
}

export function makeChecklistItem(text: string): ChecklistItem {
  return { id: genId(), text, isDone: false };
}

export function makeRequiredItem(label: string): RequiredItem {
  return { id: genId(), label, manuallyDone: false };
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
    return raw ? normalizeSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(
    KEYS.SETTINGS,
    JSON.stringify(normalizeSettings(settings)),
  );
}

export async function exportBackup(): Promise<string> {
  const [files, infoCards, kits, settings] = await Promise.all([
    getFiles(),
    getInfoCards(),
    getKits(),
    getSettings(),
  ]);

  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      note:
        'This backup contains metadata only. Physical files and device-specific security secrets are not included.',
      files,
      infoCards,
      kits,
      settings: sanitizeBackupSettings(settings),
    },
    null,
    2,
  );
}

export interface BackupPreview {
  fileCount: number;
  infoCardCount: number;
  kitCount: number;
  exportedAt?: string;
  hasSettings: boolean;
}

interface NormalizedBackup {
  version: unknown;
  files: DocumentFile[];
  infoCards: InfoCard[];
  kits: Kit[];
  settings: AppSettings;
  hasSettings: boolean;
  exportedAt?: string;
}

function normalizeBackup(data: unknown): NormalizedBackup {
  if (!isRecord(data)) {
    throw new BackupValidationError('Backup is not a valid JSON object.');
  }

  if (data.version === undefined || data.version === null) {
    throw new BackupValidationError('Backup is missing a version field.');
  }
  if (!Array.isArray(data.files)) {
    throw new BackupValidationError('Backup "files" field is missing or not an array.');
  }
  if (!Array.isArray(data.infoCards)) {
    throw new BackupValidationError('Backup "infoCards" field is missing or not an array.');
  }
  if (!Array.isArray(data.kits)) {
    throw new BackupValidationError('Backup "kits" field is missing or not an array.');
  }
  const rawSettings = data.settings;
  const hasSettings = rawSettings !== undefined;
  if (hasSettings && !isRecord(rawSettings)) {
    throw new BackupValidationError(
      'Backup "settings" field is present but not a valid object.',
    );
  }

  const files = data.files.flatMap((item) => {
    const file = normalizeDocumentFile(item);
    if (!file) {
      throw new BackupValidationError('Backup contains a file that is not an object.');
    }
    return [file];
  });

  const infoCards = data.infoCards.flatMap((item) => {
    const card = normalizeInfoCard(item);
    if (!card) {
      throw new BackupValidationError(
        'Backup contains an info card that is not an object.',
      );
    }
    return [card];
  });

  const kits = sanitizeKitReferences(data.kits.map(normalizeKit), files, infoCards);

  return {
    version: data.version,
    files,
    infoCards,
    kits,
    settings:
      sanitizeBackupSettings(
        normalizeSettings(
          isRecord(rawSettings)
            ? { ...DEFAULT_SETTINGS, ...rawSettings }
            : DEFAULT_SETTINGS,
        ),
      ) ?? DEFAULT_SETTINGS,
    hasSettings,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : undefined,
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
    exportedAt: backup.exportedAt,
    hasSettings: backup.hasSettings,
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
  const sanitizedFiles = await sanitizeMissingLocalFiles(backup.files, true);
  const entries: [string, string][] = [
    [KEYS.FILES, JSON.stringify(sanitizedFiles.files)],
    [KEYS.INFO_CARDS, JSON.stringify(backup.infoCards)],
    [KEYS.KITS, JSON.stringify(backup.kits)],
    [KEYS.SETTINGS, JSON.stringify(backup.settings)],
  ];

  const current = await AsyncStorage.multiGet([
    KEYS.FILES,
    KEYS.INFO_CARDS,
    KEYS.KITS,
    KEYS.SETTINGS,
  ]);

  try {
    await AsyncStorage.multiSet(entries);
  } catch (error) {
    const restoreEntries = current.filter(
      (entry): entry is [string, string] => entry[1] !== null,
    );
    const removeKeys = current
      .filter((entry) => entry[1] === null)
      .map(([key]) => key);

    if (restoreEntries.length > 0) await AsyncStorage.multiSet(restoreEntries);
    if (removeKeys.length > 0) await AsyncStorage.multiRemove(removeKeys);
    throw error;
  }

  return {
    fileCount: sanitizedFiles.files.length,
    infoCardCount: backup.infoCards.length,
    kitCount: backup.kits.length,
    exportedAt: backup.exportedAt,
    hasSettings: backup.hasSettings,
  };
}

export async function clearAllData(deletePhysicalFiles = true): Promise<void> {
  if (deletePhysicalFiles) {
    try {
      const dir =
        ((FileSystem as { documentDirectory?: string }).documentDirectory ?? '') +
        'docpocket/';
      const info = await FileSystem.getInfoAsync(dir);
      if (info.exists) {
        await FileSystem.deleteAsync(dir, { idempotent: true });
      }
    } catch {}
  }

  await AsyncStorage.multiRemove([
    KEYS.FILES,
    KEYS.INFO_CARDS,
    KEYS.KITS,
    KEYS.SETTINGS,
  ]);
}
