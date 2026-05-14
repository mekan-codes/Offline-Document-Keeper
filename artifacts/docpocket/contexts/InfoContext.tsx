import React, { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { addInfoCard, deleteInfoCardAndCleanKits, getInfoCards, updateInfoCard } from '@/storage/db';
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

function sortCards(cards: InfoCard[]): InfoCard[] {
  return [...cards].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function InfoProvider({ children }: { children: ReactNode }) {
  const [cards, setCardsState] = useState<InfoCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const cardsRef = useRef<InfoCard[]>([]);

  const setCards = (next: InfoCard[]) => {
    cardsRef.current = next;
    setCardsState(next);
  };

  const refreshCards = async () => {
    setCards(sortCards(await getInfoCards()));
  };

  useEffect(() => {
    refreshCards().finally(() => setLoading(false));
  }, []);

  const addCard = async (data: Omit<InfoCard, 'id' | 'createdAt' | 'updatedAt'>) => {
    const card = await addInfoCard(data);
    setCards(sortCards([...cardsRef.current, card]));
    return card;
  };

  const updateCard = async (id: string, updates: Partial<InfoCard>) => {
    const previous = cardsRef.current;
    const optimistic = sortCards(
      previous.map((card) =>
        card.id === id
          ? { ...card, ...updates, updatedAt: new Date().toISOString() }
          : card,
      ),
    );
    setCards(optimistic);

    try {
      await updateInfoCard(id, updates);
    } catch (error) {
      setCards(previous);
      throw error;
    }
  };

  const deleteCard = async (id: string) => {
    const previous = cardsRef.current;
    setCards(previous.filter((card) => card.id !== id));

    try {
      await deleteInfoCardAndCleanKits(id);
    } catch (error) {
      setCards(previous);
      throw error;
    }
  };

  const filteredCards = useMemo(() => {
    let result = cards;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        (c.title || '').toLowerCase().includes(q) ||
        (c.value || '').toLowerCase().includes(q) ||
        (c.category || '').toLowerCase().includes(q) ||
        (Array.isArray(c.tags) ? c.tags : []).some(t => t.toLowerCase().includes(q))
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
