// src/utils/storage/accounts.store.ts
import { storage } from "./port";
import { ACCOUNTS_KEY } from "./keys";
import type { AccountMeta, Role } from "./types";

export const AccountStore = {
  getAccountsMeta(): Record<string, AccountMeta> {
    try { return JSON.parse(storage.getItem(ACCOUNTS_KEY) || "{}"); } catch { return {}; }
  },
  saveAccountsMeta(obj: Record<string, AccountMeta>) {
    storage.setItem(ACCOUNTS_KEY, JSON.stringify(obj));
  },
  exists(account: string): boolean {
    return !!AccountStore.getAccountsMeta()[account];
  },
  create(account: string, password: string, role: Role = "None") {
    const metas = AccountStore.getAccountsMeta();
    if (metas[account]) throw new Error("帳號已存在");
    metas[account] = { role, password, shopIds: [] };
    AccountStore.saveAccountsMeta(metas);
  },
  verifyLogin(account: string, password: string): boolean {
    const meta = AccountStore.getAccountsMeta()[account];
    return !!meta && meta.password === password;
  },
  setRoleOf(account: string, role: Role) {
    const metas = AccountStore.getAccountsMeta();
    if (!metas[account]) return;
    metas[account].role = role;
    AccountStore.saveAccountsMeta(metas);
  },
  getAllIds(): string[] {
    try { return Object.keys(AccountStore.getAccountsMeta() || {}); } catch { return []; }
  },
};
