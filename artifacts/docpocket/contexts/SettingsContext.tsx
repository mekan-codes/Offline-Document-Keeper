import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { getSettings, saveSettings } from '@/storage/db';
import type { AppSettings } from '@/types';

const DEFAULT: AppSettings = {
  themePreference: 'system',
  pinEnabled: false,
  biometricEnabled: false,
  privacyMode: false,
  autoLockMinutes: 5,
  clearClipboardAfterSeconds: 60,
  expiryWarningDays: 60,
};

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
  resetSettingsState: () => void;
  effectiveTheme: 'light' | 'dark';
  loaded: boolean;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const systemScheme = useColorScheme();
  const settingsRef = useRef<AppSettings>(DEFAULT);

  useEffect(() => {
    getSettings().then(s => {
      settingsRef.current = s;
      setSettings(s);
      setLoaded(true);
    });
  }, []);

  const updateSettings = async (updates: Partial<AppSettings>) => {
    const next = { ...settingsRef.current, ...updates };
    settingsRef.current = next;
    setSettings(next);
    await saveSettings(next);
  };

  const refreshSettings = async () => {
    const next = await getSettings();
    settingsRef.current = next;
    setSettings(next);
  };

  const resetSettingsState = () => {
    settingsRef.current = DEFAULT;
    setSettings(DEFAULT);
  };

  const effectiveTheme: 'light' | 'dark' = useMemo(() => {
    if (settings.themePreference === 'light') return 'light';
    if (settings.themePreference === 'dark') return 'dark';
    return systemScheme === 'dark' ? 'dark' : 'light';
  }, [settings.themePreference, systemScheme]);

  const value = useMemo(() => ({ settings, updateSettings, refreshSettings, resetSettingsState, effectiveTheme, loaded }), [settings, effectiveTheme, loaded]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
