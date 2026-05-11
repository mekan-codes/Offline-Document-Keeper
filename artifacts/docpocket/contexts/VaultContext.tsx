import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { getFiles, saveFiles, addFile, updateFile, deleteFileAndCleanKits } from '@/storage/db';
import type { DocumentFile } from '@/types';

interface VaultContextValue {
  files: DocumentFile[];
  loading: boolean;
  refreshFiles: () => Promise<void>;
  addNewFile: (data: Omit<DocumentFile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<DocumentFile>;
  updateFileById: (id: string, updates: Partial<DocumentFile>) => Promise<void>;
  deleteFileById: (id: string) => Promise<void>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeFilter: string;
  setActiveFilter: (f: string) => void;
  filteredFiles: DocumentFile[];
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const refreshFiles = async () => {
    const f = await getFiles();
    setFiles(f.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
  };

  useEffect(() => {
    refreshFiles().finally(() => setLoading(false));
  }, []);

  const addNewFile = async (data: Omit<DocumentFile, 'id' | 'createdAt' | 'updatedAt'>) => {
    const file = await addFile(data);
    await refreshFiles();
    return file;
  };

  const updateFileById = async (id: string, updates: Partial<DocumentFile>) => {
    await updateFile(id, updates);
    await refreshFiles();
  };

  const deleteFileById = async (id: string) => {
    await deleteFileAndCleanKits(id);
    await refreshFiles();
  };

  const filteredFiles = useMemo(() => {
    let result = files;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.tags.some(t => t.toLowerCase().includes(q)) ||
        f.note.toLowerCase().includes(q) ||
        f.category.includes(q)
      );
    }
    if (activeFilter === 'all') return result;
    if (activeFilter === 'favorites') return result.filter(f => f.isFavorite);
    if (activeFilter === 'recent') return result.slice(0, 20);
    if (activeFilter === 'pdfs') return result.filter(f => f.mimeType.includes('pdf'));
    return result.filter(f => f.category === activeFilter);
  }, [files, searchQuery, activeFilter]);

  const value = useMemo(() => ({
    files, loading, refreshFiles,
    addNewFile, updateFileById, deleteFileById,
    searchQuery, setSearchQuery,
    activeFilter, setActiveFilter,
    filteredFiles,
  }), [files, loading, searchQuery, activeFilter, filteredFiles]);

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be used within VaultProvider');
  return ctx;
}
