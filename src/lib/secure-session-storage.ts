import AsyncStorage from '@react-native-async-storage/async-storage';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { bytesToUtf8, utf8ToBytes } from '@/lib/utf8';

/**
 * Where supabase-js keeps the session on phones. The session (about 3 KB) is too big for
 * SecureStore, so it's sealed with AES-GCM and kept in AsyncStorage, and only the 256-bit key goes
 * in SecureStore (Android Keystore / iOS Keychain, this device only). A copied AsyncStorage file
 * is useless without the key.
 *
 * Sessions saved in plain text by older builds are read once and saved again sealed, so updating
 * the app doesn't sign anyone out. A sealed value whose key is missing (data restored on another
 * phone) reads as signed out.
 */
const PREFIX = 'enc1:';
const KEY_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

// SecureStore keys allow letters, digits, ".", "-" and "_".
function keyName(name: string) {
  return `${name.replace(/[^A-Za-z0-9._-]/g, '_')}.key`;
}

async function loadKey(name: string) {
  const stored = await SecureStore.getItemAsync(keyName(name), KEY_OPTIONS);
  return stored ? AESEncryptionKey.import(stored, 'base64') : null;
}

async function seal(name: string, value: string) {
  let key = await loadKey(name);
  if (!key) {
    key = await AESEncryptionKey.generate();
    await SecureStore.setItemAsync(keyName(name), await key.encoded('base64'), KEY_OPTIONS);
  }
  const sealed = await aesEncryptAsync(utf8ToBytes(value), key);
  return PREFIX + (await sealed.combined('base64'));
}

export const secureSessionStorage = {
  async getItem(name: string): Promise<string | null> {
    const stored = await AsyncStorage.getItem(name);
    if (stored == null) return null;
    if (!stored.startsWith(PREFIX)) {
      // Saved by an older build (or a keystore that failed): seal it now.
      await secureSessionStorage.setItem(name, stored).catch(() => {});
      return stored;
    }
    try {
      const key = await loadKey(name);
      if (!key) throw new Error('No key on this device');
      const sealed = AESSealedData.fromCombined(stored.slice(PREFIX.length));
      return bytesToUtf8(await aesDecryptAsync(sealed, key, { output: 'bytes' }));
    } catch {
      await AsyncStorage.removeItem(name);
      return null;
    }
  },

  async setItem(name: string, value: string): Promise<void> {
    // A phone whose keystore fails still has to stay signed in, so fall back to plain text there.
    const stored = await seal(name, value).catch(() => value);
    await AsyncStorage.setItem(name, stored);
  },

  async removeItem(name: string): Promise<void> {
    await AsyncStorage.removeItem(name);
    await SecureStore.deleteItemAsync(keyName(name), KEY_OPTIONS).catch(() => {});
  },
};
