import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { secureSessionStorage } from '@/lib/secure-session-storage';
import { bytesToUtf8, utf8ToBytes } from '@/lib/utf8';

const mockKeychain = new Map<string, string>();
let mockFailKeystore = false;

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'this-device',
  getItemAsync: jest.fn(async (k: string) => mockKeychain.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    if (mockFailKeystore) throw new Error('keystore broken');
    mockKeychain.set(k, v);
  }),
  deleteItemAsync: jest.fn(async (k: string) => void mockKeychain.delete(k)),
}));

// A stand-in cipher: XOR with the key byte, base64 for the combined form. Enough to prove the
// stored text isn't the session and only the right key opens it.
jest.mock('expo-crypto', () => {
  const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');
  class Key {
    byte: number;
    constructor(value: number) {
      this.byte = value;
    }
    static async generate() {
      return new Key(1 + Math.floor(Math.random() * 200));
    }
    static async import(text: string) {
      return new Key(Number(Buffer.from(text, 'base64').toString()));
    }
    async encoded() {
      return Buffer.from(String(this.byte)).toString('base64');
    }
  }
  class Sealed {
    data: Uint8Array;
    constructor(value: Uint8Array) {
      this.data = value;
    }
    static fromCombined(text: string) {
      return new Sealed(Uint8Array.from(Buffer.from(text, 'base64')));
    }
    async combined() {
      return b64(this.data);
    }
  }
  return {
    AESEncryptionKey: Key,
    AESSealedData: Sealed,
    aesEncryptAsync: async (bytes: Uint8Array, key: Key) =>
      new Sealed(bytes.map((b) => b ^ key.byte)),
    aesDecryptAsync: async (sealed: Sealed, key: Key) => sealed.data.map((b) => b ^ key.byte),
  };
});

const NAME = 'sb-suwvhennkhhtoutbcbti-auth-token';
const SESSION = JSON.stringify({ access_token: 'jwt', user: { full_name: 'முருகன் 💪' } });

beforeEach(async () => {
  mockKeychain.clear();
  mockFailKeystore = false;
  await AsyncStorage.clear();
});

describe('secureSessionStorage', () => {
  it('stores the session sealed and reads it back', async () => {
    await secureSessionStorage.setItem(NAME, SESSION);
    const raw = await AsyncStorage.getItem(NAME);
    expect(raw?.startsWith('enc1:')).toBe(true);
    expect(raw).not.toContain('jwt');
    expect(mockKeychain.has(`${NAME}.key`)).toBe(true);
    expect(await secureSessionStorage.getItem(NAME)).toBe(SESSION);
  });

  it('keeps an older plain-text session and seals it', async () => {
    await AsyncStorage.setItem(NAME, SESSION);
    expect(await secureSessionStorage.getItem(NAME)).toBe(SESSION);
    expect((await AsyncStorage.getItem(NAME))?.startsWith('enc1:')).toBe(true);
    expect(await secureSessionStorage.getItem(NAME)).toBe(SESSION);
  });

  it('reads as signed out when the key is missing, such as data restored on another phone', async () => {
    await secureSessionStorage.setItem(NAME, SESSION);
    mockKeychain.clear();
    expect(await secureSessionStorage.getItem(NAME)).toBeNull();
    expect(await AsyncStorage.getItem(NAME)).toBeNull();
  });

  it('falls back to plain text when the keystore fails, so sign-in still works', async () => {
    mockFailKeystore = true;
    await secureSessionStorage.setItem(NAME, SESSION);
    expect(await AsyncStorage.getItem(NAME)).toBe(SESSION);
    expect(await secureSessionStorage.getItem(NAME)).toBe(SESSION);
  });

  it('removes the session and its key', async () => {
    await secureSessionStorage.setItem(NAME, SESSION);
    await secureSessionStorage.removeItem(NAME);
    expect(await AsyncStorage.getItem(NAME)).toBeNull();
    expect(mockKeychain.size).toBe(0);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  });
});

describe('utf8', () => {
  it('round-trips Tamil, ₹ and emoji', () => {
    const text = 'வணக்கம் ₹4,999 💪 a';
    expect(bytesToUtf8(utf8ToBytes(text))).toBe(text);
    expect(Array.from(utf8ToBytes('₹'))).toEqual([0xe2, 0x82, 0xb9]);
  });
});
