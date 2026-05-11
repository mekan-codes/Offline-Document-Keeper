import type { FileCategory, InfoCategory } from '@/types';

export const FILE_CATEGORY_CONFIG: Record<FileCategory, { label: string; color: string; icon: string }> = {
  identity: { label: 'Identity', color: '#3B82F6', icon: 'person-circle' },
  visa: { label: 'Visa', color: '#8B5CF6', icon: 'globe' },
  travel: { label: 'Travel', color: '#10B981', icon: 'airplane' },
  school: { label: 'School', color: '#F59E0B', icon: 'school' },
  medical: { label: 'Medical', color: '#EF4444', icon: 'medkit' },
  photos: { label: 'Photos', color: '#EC4899', icon: 'images' },
  other: { label: 'Other', color: '#6B7280', icon: 'document' },
};

export const INFO_CATEGORY_CONFIG: Record<InfoCategory, { label: string; color: string }> = {
  identity: { label: 'Identity', color: '#3B82F6' },
  contact: { label: 'Contact', color: '#10B981' },
  address: { label: 'Address', color: '#F59E0B' },
  school: { label: 'School', color: '#8B5CF6' },
  travel: { label: 'Travel', color: '#00C2CC' },
  emergency: { label: 'Emergency', color: '#EF4444' },
  custom: { label: 'Custom', color: '#6B7280' },
};

export const KIT_COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#00C2CC', '#6366F1',
];

export const KIT_ICON_NAMES = [
  'briefcase', 'airplane', 'school', 'medkit',
  'home', 'card', 'document-text', 'shield-checkmark',
];

export const EXPIRY_STATUS = {
  valid: { label: 'Valid', color: '#10B981' },
  soon: { label: 'Expiring Soon', color: '#F59E0B' },
  expired: { label: 'Expired', color: '#EF4444' },
} as const;

export function getExpiryStatus(expiryDate: string | undefined, warningDays: number): keyof typeof EXPIRY_STATUS | null {
  if (!expiryDate) return null;
  const now = new Date();
  const expiry = new Date(expiryDate);
  const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= warningDays) return 'soon';
  return 'valid';
}
