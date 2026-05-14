import React, { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { addKit, deleteKit, getKits, updateKit } from '@/storage/db';
import type { ChecklistItem, Kit } from '@/types';

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

function sortKits(kits: Kit[]): Kit[] {
  return [...kits].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function KitsProvider({ children }: { children: ReactNode }) {
  const [kits, setKitsState] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const kitsRef = useRef<Kit[]>([]);

  const setKits = (next: Kit[]) => {
    kitsRef.current = next;
    setKitsState(next);
  };

  const refreshKits = async () => {
    setKits(sortKits(await getKits()));
  };

  useEffect(() => {
    refreshKits().finally(() => setLoading(false));
  }, []);

  const addNewKit = async (data: Omit<Kit, 'id' | 'createdAt' | 'updatedAt'>) => {
    const kit = await addKit(data);
    setKits(sortKits([...kitsRef.current, kit]));
    return kit;
  };

  const updateKitById = async (id: string, updates: Partial<Kit>) => {
    const previous = kitsRef.current;
    const optimistic = sortKits(
      previous.map((kit) =>
        kit.id === id
          ? { ...kit, ...updates, updatedAt: new Date().toISOString() }
          : kit,
      ),
    );
    setKits(optimistic);

    try {
      await updateKit(id, updates);
    } catch (error) {
      setKits(previous);
      throw error;
    }
  };

  const deleteKitById = async (id: string) => {
    const previous = kitsRef.current;
    setKits(previous.filter((kit) => kit.id !== id));

    try {
      await deleteKit(id);
    } catch (error) {
      setKits(previous);
      throw error;
    }
  };

  const toggleChecklistItem = async (kitId: string, itemId: string) => {
    const kit = kitsRef.current.find(k => k.id === kitId);
    if (!kit) return;

    const checklistItems: ChecklistItem[] = kit.checklistItems.map(item =>
      item.id === itemId ? { ...item, isDone: !item.isDone } : item,
    );
    await updateKitById(kitId, { checklistItems });
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
