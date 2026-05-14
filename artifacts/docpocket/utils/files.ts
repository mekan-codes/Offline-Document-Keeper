import type { DocumentFile } from '@/types';

export const MISSING_LOCAL_FILE_NOTE =
  'Local file is unavailable on this device. Re-import the original document to restore access.';

export function hasLocalFile(file: Pick<DocumentFile, 'localUri'>): boolean {
  return file.localUri.trim().length > 0;
}

export function ensureMissingLocalFileNote(note: string): string {
  const trimmed = note.trim();
  if (!trimmed) return MISSING_LOCAL_FILE_NOTE;
  if (trimmed.includes(MISSING_LOCAL_FILE_NOTE)) return trimmed;
  return `${MISSING_LOCAL_FILE_NOTE}\n\n${trimmed}`;
}

export function getMissingLocalFileMessage(fileName = 'This file'): string {
  return `${fileName} is only available as metadata on this device. Re-import the original document to restore access.`;
}
