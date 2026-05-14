import React, { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  ready: boolean;
  isPinSetup: boolean;
  hasBiometrics: boolean;
  lock: () => void;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  authenticateWithBiometrics: (promptMessage?: string) => Promise<boolean>;
  setupPin: (pin: string) => Promise<void>;
  changePin: (oldPin: string, newPin: string) => Promise<boolean>;
  disablePin: (pin: string) => Promise<boolean>;
  resetLockState: () => Promise<void>;
  pinError: string | null;
  clearPinError: () => void;
}

const AppLockContext = createContext<AppLockContextValue | null>(null);

export function AppLockProvider({ children }: { children: ReactNode }) {
  const { settings, loaded } = useSettings();
  const [isLocked, setIsLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [isPinSetup, setIsPinSetup] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const backgroundTimestamp = useRef<number | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!loaded) {
      setReady(false);
      return;
    }

    let cancelled = false;
    if (!initialized.current) setReady(false);

    async function init() {
      const hash = await getStoredHash();
      if (cancelled) return;

      const pinExists = hash !== null;
      setIsPinSetup(pinExists);
      if (!initialized.current) {
        setIsLocked(pinExists && settings.pinEnabled);
      } else if (!settings.pinEnabled) {
        setIsLocked(false);
      }

      try {
        const hasHW = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (cancelled) return;
        setHasBiometrics(hasHW && isEnrolled);
      } catch {
        if (cancelled) return;
        setHasBiometrics(false);
      }

      initialized.current = true;
      setReady(true);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [loaded, settings.pinEnabled]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (!initialized.current) return;

      if (state === 'background' || state === 'inactive') {
        backgroundTimestamp.current = Date.now();
        if (settings.autoLockMinutes === 0 && settings.pinEnabled && isPinSetup) {
          setIsLocked(true);
        }
        return;
      }

      if (state === 'active') {
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

  const authenticateWithBiometrics = async (
    promptMessage = 'Unlock DocPocket',
  ): Promise<boolean> => {
    if (Platform.OS === 'web' || !hasBiometrics) return false;

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
      });
      return result.success;
    } catch {
      return false;
    }
  };

  const unlockWithBiometrics = async (): Promise<boolean> => {
    const success = await authenticateWithBiometrics('Unlock DocPocket');
    if (success) {
      setIsLocked(false);
      setPinError(null);
    }
    return success;
  };

  const setupPin = async (pin: string): Promise<void> => {
    await storeHash(hashPin(pin));
    setIsPinSetup(true);
    setIsLocked(false);
    setPinError(null);
  };

  const changePin = async (oldPin: string, newPin: string): Promise<boolean> => {
    const stored = await getStoredHash();
    if (!stored || stored !== hashPin(oldPin)) return false;

    await storeHash(hashPin(newPin));
    setPinError(null);
    return true;
  };

  const disablePin = async (pin: string): Promise<boolean> => {
    const stored = await getStoredHash();
    if (!stored || stored !== hashPin(pin)) return false;

    await clearHash();
    setIsPinSetup(false);
    setIsLocked(false);
    setPinError(null);
    return true;
  };

  const resetLockState = async (): Promise<void> => {
    try {
      await clearHash();
    } catch {}
    setIsPinSetup(false);
    setIsLocked(false);
    setReady(true);
    setPinError(null);
    backgroundTimestamp.current = null;
  };

  const clearPinError = () => setPinError(null);

  const value = useMemo(
    () => ({
      isLocked,
      ready,
      isPinSetup,
      hasBiometrics,
      lock,
      unlockWithPin,
      unlockWithBiometrics,
      authenticateWithBiometrics,
      setupPin,
      changePin,
      disablePin,
      resetLockState,
      pinError,
      clearPinError,
    }),
    [isLocked, ready, isPinSetup, hasBiometrics, pinError, settings.pinEnabled],
  );

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock() {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used within AppLockProvider');
  return ctx;
}
