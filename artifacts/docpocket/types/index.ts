export type FileCategory = 'identity' | 'visa' | 'travel' | 'school' | 'medical' | 'photos' | 'other';
export type InfoCategory = 'identity' | 'contact' | 'address' | 'school' | 'travel' | 'emergency' | 'custom';
export type ThemePreference = 'system' | 'light' | 'dark';

export interface DocumentFile {
  id: string;
  name: string;
  originalFileName: string;
  localUri: string;
  mimeType: string;
  sizeBytes: number;
  category: FileCategory;
  tags: string[];
  note: string;
  requirementsNote: string;
  expiryDate?: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
  lastSharedAt?: string;
  isFavorite: boolean;
  isSensitive: boolean;
}

export interface InfoCard {
  id: string;
  title: string;
  value: string;
  category: InfoCategory;
  tags: string[];
  isSensitive: boolean;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  lastCopiedAt?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  isDone: boolean;
}

export interface RequiredItem {
  id: string;
  label: string;
  linkedFileId?: string;
  linkedInfoCardId?: string;
  manuallyDone: boolean;
}

export interface Kit {
  id: string;
  name: string;
  color: string;
  icon: string;
  fileIds: string[];
  infoCardIds: string[];
  checklistItems: ChecklistItem[];
  requiredItems: RequiredItem[];
  requirementsNote: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  themePreference: ThemePreference;
  pinEnabled: boolean;
  biometricEnabled: boolean;
  privacyMode: boolean;
  autoLockMinutes: number;
  clearClipboardAfterSeconds: number;
  expiryWarningDays: number;
  lastBackupDate?: string;
}

export type FilterChip = 'all' | FileCategory | 'recent' | 'favorites' | 'pdfs';
