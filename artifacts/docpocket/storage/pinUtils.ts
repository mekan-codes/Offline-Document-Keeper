import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const PIN_KEY = 'docpocket_pin_hash';

export function hashPin(pin: string): string {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return 'h' + Math.abs(hash).toString(16) + pin.length.toString();
}

export async function verifyPin(pin: string): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  try {
    const stored = await SecureStore.getItemAsync(PIN_KEY);
    return stored !== null && stored === hashPin(pin);
  } catch {
    return false;
  }
}
