import React, { createContext, useContext, useState, useEffect, useRef, useMemo, ReactNode } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSettings } from './SettingsContext';

const PIN_KEY = 'docpocket_pin_hash';

function hashPin(pin: string): string {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return 'h' + Math.abs(hash).toString(16) + pin.length.toString();
}

async function getStoredHash(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return null;
    return await SecureStore.getItemAsync(PIN_KEY);
  } catch {
    return null;
  }
}

async function storeHash(hash: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await SecureStore.setItemAsync(PIN_KEY, hash);
}

async function clearHash(): Promise<void> {
  if (Platform.OS === 'web') return;
  await SecureStore.deleteItemAsync(PIN_KEY);
}

interface AppLockContextValue {
  isLocked: boolean;
  isPinSetup: boolean;
  hasBiometrics: boolean;
  lock: () => void;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  setupPin: (pin: string) => Promise<void>;
  changePin: (oldPin: string, newPin: string) => Promise<boolean>;
  disablePin: (pin: string) => Promise<boolean>;
  pinError: string | null;
  clearPinError: () => void;
}

const AppLockContext = createContext<AppLockContextValue | null>(null);

export function AppLockProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [isLocked, setIsLocked] = useState(false);
  const [isPinSetup, setIsPinSetup] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const backgroundTimestamp = useRef<number | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    async function init() {
      const hash = await getStoredHash();
      const pinExists = hash !== null;
      setIsPinSetup(pinExists);
      if (pinExists && settings.pinEnabled) {
        setIsLocked(true);
      }

      try {
        const hasHW = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        setHasBiometrics(hasHW && isEnrolled);
      } catch {
        setHasBiometrics(false);
      }
      initialized.current = true;
    }
    init();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (!initialized.current) return;
      if (state === 'background' || state === 'inactive') {
        backgroundTimestamp.current = Date.now();
        if (settings.autoLockMinutes === 0 && settings.pinEnabled && isPinSetup) {
          setIsLocked(true);
        }
      } else if (state === 'active') {
        if (backgroundTimestamp.current && settings.pinEnabled && isPinSetup) {
          const elapsed = (Date.now() - backgroundTimestamp.current) / 1000 / 60;
          if (settings.autoLockMinutes === 0 || elapsed >= settings.autoLockMinutes) {
            setIsLocked(true);
          }
        }
        backgroundTimestamp.current = null;
      }
    });
    return () => sub.remove();
  }, [settings.pinEnabled, settings.autoLockMinutes, isPinSetup]);

  const lock = () => {
    if (settings.pinEnabled && isPinSetup) setIsLocked(true);
  };

  const unlockWithPin = async (pin: string): Promise<boolean> => {
    const stored = await getStoredHash();
    if (!stored) return false;
    const match = stored === hashPin(pin);
    if (match) {
      setIsLocked(false);
      setPinError(null);
    } else {
      setPinError('Incorrect PIN');
    }
    return match;
  };

  const unlockWithBiometrics = async (): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock DocPocket',
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
      });
      if (result.success) {
        setIsLocked(false);
        setPinError(null);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const setupPin = async (pin: string): Promise<void> => {
    await storeHash(hashPin(pin));
    setIsPinSetup(true);
    setIsLocked(false);
  };

  const changePin = async (oldPin: string, newPin: string): Promise<boolean> => {
    const stored = await getStoredHash();
    if (!stored || stored !== hashPin(oldPin)) return false;
    await storeHash(hashPin(newPin));
    return true;
  };

  const disablePin = async (pin: string): Promise<boolean> => {
    const stored = await getStoredHash();
    if (!stored || stored !== hashPin(pin)) return false;
    await clearHash();
    setIsPinSetup(false);
    setIsLocked(false);
    return true;
  };

  const clearPinError = () => setPinError(null);

  const value = useMemo(() => ({
    isLocked, isPinSetup, hasBiometrics,
    lock, unlockWithPin, unlockWithBiometrics,
    setupPin, changePin, disablePin, pinError, clearPinError,
  }), [isLocked, isPinSetup, hasBiometrics, pinError]);

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock() {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used within AppLockProvider');
  return ctx;
}
