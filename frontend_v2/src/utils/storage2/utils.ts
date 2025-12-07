// src/utils/storage/utils.ts
import { storage } from "./port";
import { CURR_SHOP_KEY, DEFAULT_SHOP_ID } from "./keys";

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}
export function saveJSON(key: string, value: any) {
  storage.setItem(key, JSON.stringify(value));
}

export const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));
export const isBlank = (s?: string | null) => !s || String(s).trim() === "";

export function ensureShopId(input?: string): string {
  // Read current shopId directly to avoid circular deps with Auth store.
  const selected = storage.getItem(CURR_SHOP_KEY);
  return input ?? selected ?? DEFAULT_SHOP_ID;
}

export const getCurrentShopIdSafe = () => ensureShopId();

export function uid(prefix = ""): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let id = "";
  for (let i = 0; i < b.length; i++) id += chars[b[i] & 63];
  return prefix ? `${prefix}_${id}` : id;
}

export function normalizePid(pid: number | string): string {
  if (typeof pid === "number") return String(pid);
  return String(pid || "").trim();
}
