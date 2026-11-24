import * as SecureStore from 'expo-secure-store';

import type { KeyValueStore } from '../domain/counter';
import { parsePairing, type Pairing } from '../domain/pairing';

const PAIRING_KEY = 'volvo.pairing';
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

/** Emparejamiento (contiene la clave del dispositivo): solo en Keychain/Keystore, nunca en claro. */
export async function loadPairing(): Promise<Pairing | null> {
  const raw = await SecureStore.getItemAsync(PAIRING_KEY, OPTIONS);
  return raw ? parsePairing(raw) : null;
}

export async function savePairing(link: string): Promise<void> {
  await SecureStore.setItemAsync(PAIRING_KEY, link.trim(), OPTIONS);
}

export async function clearPairing(deviceId: string): Promise<void> {
  await SecureStore.deleteItemAsync(PAIRING_KEY, OPTIONS);
  await SecureStore.deleteItemAsync(counterKey(deviceId), OPTIONS);
}

export const counterKey = (deviceId: string): string => `volvo.counter.${deviceId}`;

/** Almacén del contador de muestras (debe sobrevivir a reinicios para no repetir nonces). */
export const secureKeyValueStore: KeyValueStore = {
  get: (key) => SecureStore.getItemAsync(key, OPTIONS),
  set: (key, value) => SecureStore.setItemAsync(key, value, OPTIONS),
};
