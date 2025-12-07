// src/utils/storage/port.ts
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

class LocalStoragePort implements StoragePort {
  getItem(key: string) { return localStorage.getItem(key); }
  setItem(key: string, value: string) { localStorage.setItem(key, value); }
  removeItem(key: string) { localStorage.removeItem(key); }
  keys() {
    const ks: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) ks.push(k);
    }
    return ks;
  }
}

// Swap this instance when migrating to IndexedDB or remote API caching.
export const storage: StoragePort = new LocalStoragePort();
