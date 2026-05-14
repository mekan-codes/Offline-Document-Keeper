import React, { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { addFile, deleteFileAndCleanKits, getFiles, updateFile } from '@/storage/db';
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

function sortFiles(files: DocumentFile[]): DocumentFile[] {
  return [...files].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const [files, setFilesState] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const filesRef = useRef<DocumentFile[]>([]);

  const setFiles = (next: DocumentFile[]) => {
    filesRef.current = next;
    setFilesState(next);
  };

  const refreshFiles = async () => {
    setFiles(sortFiles(await getFiles()));
  };

  useEffect(() => {
    refreshFiles().finally(() => setLoading(false));
  }, []);

  const addNewFile = async (data: Omit<DocumentFile, 'id' | 'createdAt' | 'updatedAt'>) => {
    const file = await addFile(data);
    setFiles(sortFiles([...filesRef.current, file]));
    return file;
  };

  const updateFileById = async (id: string, updates: Partial<DocumentFile>) => {
    const previous = filesRef.current;
    const optimistic = sortFiles(
      previous.map((file) =>
        file.id === id
          ? { ...file, ...updates, updatedAt: new Date().toISOString() }
          : file,
      ),
    );
    setFiles(optimistic);

    try {
      await updateFile(id, updates);
    } catch (error) {
      setFiles(previous);
      throw error;
    }
  };

  const deleteFileById = async (id: string) => {
    const previous = filesRef.current;
    setFiles(previous.filter((file) => file.id !== id));

    try {
      await deleteFileAndCleanKits(id);
    } catch (error) {
      setFiles(previous);
      throw error;
    }
  };

  const filteredFiles = useMemo(() => {
    let result = files;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f =>
        (f.name || '').toLowerCase().includes(q) ||
        (f.originalFileName || '').toLowerCase().includes(q) ||
        (Array.isArray(f.tags) ? f.tags : []).some(t => t.toLowerCase().includes(q)) ||
        (f.note || '').toLowerCase().includes(q) ||
        (f.requirementsNote || '').toLowerCase().includes(q) ||
        (f.category || '').toLowerCase().includes(q)
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
