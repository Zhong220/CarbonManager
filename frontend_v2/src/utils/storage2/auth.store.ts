// src/utils/storage/auth.store.ts
import { storage } from "./port";
import { ACCOUNTS_KEY, CURR_ACC_KEY, CURR_ROLE_KEY, CURR_SHOP_KEY, SHOPS_KEY } from "./keys";
import type { AccountMeta, Role } from "./types";

const LEGACY_CURR_ACC_KEY = "current_account";

const getAccountsMeta = (): Record<string, AccountMeta> => {
  try { return JSON.parse(storage.getItem(ACCOUNTS_KEY) || "{}"); } catch { return {}; }
};
const saveAccountsMeta = (obj: Record<string, AccountMeta>) =>
  storage.setItem(ACCOUNTS_KEY, JSON.stringify(obj));

export const AuthStore = {
  getAccount(): string { return storage.getItem(CURR_ACC_KEY) || ""; },
  setAccount(v: string) { storage.setItem(CURR_ACC_KEY, v); },
  clearAccount() { storage.removeItem(CURR_ACC_KEY); },

  getRole(): Role { return (storage.getItem(CURR_ROLE_KEY) as Role) || "None"; },
  setRole(v: Role) { storage.setItem(CURR_ROLE_KEY, v); },

  getCurrentShopId(): string | null { return storage.getItem(CURR_SHOP_KEY); },
  setCurrentShopId(id: string) {
    storage.setItem(CURR_SHOP_KEY, id);
    const acc = AuthStore.getAccount();
    if (!acc) return;
    const metas = getAccountsMeta();
    if (metas[acc]) {
      metas[acc].currentShopId = id;
      saveAccountsMeta(metas);
    }
  },

  softLogout() {
    storage.removeItem(CURR_ACC_KEY);
    storage.removeItem(CURR_ROLE_KEY);
    storage.removeItem(CURR_SHOP_KEY);
  },

  migrateLegacyAuthKeys() {
    try {
      const legacy = storage.getItem(LEGACY_CURR_ACC_KEY);
      if (legacy && !storage.getItem(CURR_ACC_KEY)) {
        storage.setItem(CURR_ACC_KEY, legacy);
      }
      if (legacy) storage.removeItem(LEGACY_CURR_ACC_KEY);

      const acc = AuthStore.getAccount();
      const meta = acc ? getAccountsMeta()[acc] : undefined;
      const currentRole = AuthStore.getRole();
      if (acc && meta && currentRole === "None" && meta.role && meta.role !== "None") {
        AuthStore.setRole(meta.role);
      }
    } catch (e) {
      console.warn("[migrateLegacyAuthKeys] error:", e);
    }
  },

  // Convenience for deletion flows
  nukeAuthAndMaps() {
    ["CFP_auth_token", CURR_ACC_KEY, CURR_ROLE_KEY, CURR_SHOP_KEY, SHOPS_KEY].forEach(k => storage.removeItem(k));
  },

  legacyKey: LEGACY_CURR_ACC_KEY,
};
