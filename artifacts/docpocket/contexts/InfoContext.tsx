import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { getInfoCards, addInfoCard, updateInfoCard, deleteInfoCardAndCleanKits } from '@/storage/db';
import type { InfoCard } from '@/types';

interface InfoContextValue {
  cards: InfoCard[];
  loading: boolean;
  refreshCards: () => Promise<void>;
  addCard: (data: Omit<InfoCard, 'id' | 'createdAt' | 'updatedAt'>) => Promise<InfoCard>;
  updateCard: (id: string, updates: Partial<InfoCard>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  filteredCards: InfoCard[];
}

const InfoContext = createContext<InfoContextValue | null>(null);

export function InfoProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useState<InfoCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const refreshCards = async () => {
    const c = await getInfoCards();
    setCards(c.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }));
  };

  useEffect(() => {
    refreshCards().finally(() => setLoading(false));
  }, []);

  const addCard = async (data: Omit<InfoCard, 'id' | 'createdAt' | 'updatedAt'>) => {
    const card = await addInfoCard(data);
    await refreshCards();
    return card;
  };

  const updateCard = async (id: string, updates: Partial<InfoCard>) => {
    await updateInfoCard(id, updates);
    await refreshCards();
  };

  const deleteCard = async (id: string) => {
    await deleteInfoCardAndCleanKits(id);
    await refreshCards();
  };

  const filteredCards = useMemo(() => {
    let result = cards;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.value.toLowerCase().includes(q) ||
        c.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    if (activeCategory !== 'all') {
      result = result.filter(c => c.category === activeCategory);
    }
    return result;
  }, [cards, searchQuery, activeCategory]);

  const value = useMemo(() => ({
    cards, loading, refreshCards,
    addCard, updateCard, deleteCard,
    searchQuery, setSearchQuery,
    activeCategory, setActiveCategory,
    filteredCards,
  }), [cards, loading, searchQuery, activeCategory, filteredCards]);

  return <InfoContext.Provider value={value}>{children}</InfoContext.Provider>;
}

export function useInfo() {
  const ctx = useContext(InfoContext);
  if (!ctx) throw new Error('useInfo must be used within InfoProvider');
  return ctx;
}
