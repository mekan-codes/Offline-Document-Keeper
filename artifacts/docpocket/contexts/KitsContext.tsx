import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { getKits, addKit, updateKit, deleteKit } from '@/storage/db';
import type { Kit, ChecklistItem } from '@/types';

interface KitsContextValue {
  kits: Kit[];
  loading: boolean;
  refreshKits: () => Promise<void>;
  addNewKit: (data: Omit<Kit, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Kit>;
  updateKitById: (id: string, updates: Partial<Kit>) => Promise<void>;
  deleteKitById: (id: string) => Promise<void>;
  toggleChecklistItem: (kitId: string, itemId: string) => Promise<void>;
}

const KitsContext = createContext<KitsContextValue | null>(null);

export function KitsProvider({ children }: { children: ReactNode }) {
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshKits = async () => {
    const k = await getKits();
    setKits(k.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
  };

  useEffect(() => {
    refreshKits().finally(() => setLoading(false));
  }, []);

  const addNewKit = async (data: Omit<Kit, 'id' | 'createdAt' | 'updatedAt'>) => {
    const kit = await addKit(data);
    await refreshKits();
    return kit;
  };

  const updateKitById = async (id: string, updates: Partial<Kit>) => {
    await updateKit(id, updates);
    await refreshKits();
  };

  const deleteKitById = async (id: string) => {
    await deleteKit(id);
    await refreshKits();
  };

  const toggleChecklistItem = async (kitId: string, itemId: string) => {
    const kit = kits.find(k => k.id === kitId);
    if (!kit) return;
    const items = kit.checklistItems.map(item =>
      item.id === itemId ? { ...item, isDone: !item.isDone } : item
    );
    await updateKit(kitId, { checklistItems: items });
    await refreshKits();
  };

  const value = useMemo(() => ({
    kits, loading, refreshKits,
    addNewKit, updateKitById, deleteKitById, toggleChecklistItem,
  }), [kits, loading]);

  return <KitsContext.Provider value={value}>{children}</KitsContext.Provider>;
}

export function useKits() {
  const ctx = useContext(KitsContext);
  if (!ctx) throw new Error('useKits must be used within KitsProvider');
  return ctx;
}
