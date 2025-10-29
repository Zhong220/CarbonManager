import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  getAccount as loadAccount,
  clearAccount as clearCurrentAccount,
  setRoleOf,
  Role,
  softLogout,
  setAccount as saveCurrentAccount,
  setRole as saveRole,
  deleteAccountCompletely,
  clearShopsData,
  hardAppReset,
  getAccountsMeta,
  getShopsMap,
  saveShopsMap,
} from "../utils/storage";
import { auth } from "@/api";

const TOKEN_KEY = "CFP_auth_token";

interface UserCtx {
  ready: boolean;
  account: string | null;
  role: Role;
  token: string | null;

  login: (account: string, password: string) => Promise<void>;
  signup: (opts: { account: string; password: string; role: Role; shopName?: string }) => Promise<void>;
  logout: (fullWipe?: boolean) => Promise<void>;
  chooseRole: (r: Role) => void;
  refresh: () => Promise<void>;
  removeMyAccount: () => Promise<void>;
}

const Ctx = createContext<UserCtx | null>(null);
export const useUser = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("UserContext not mounted");
  return c;
};

/** 掃描 localStorage 中可疑的 shopIds（備援用） */
function scanAllShopIdsFromLocal(): string[] {
  const ids = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    const m = k.match(/^shop_(.+?)_(products|categories|records_.+|recent_cat_ids)$/);
    if (m) ids.add(m[1]);
  }
  return Array.from(ids);
}

/** 嘗試清除某帳號所有本機資料（即使 accounts_meta 沒紀錄也盡力清） */
function wipeLocalDataForAccount(account: string | null) {
  if (!account) return;
  const metas = getAccountsMeta();
  const meta = metas[account];

  if (meta?.shopIds?.length) {
    deleteAccountCompletely(account);
    return;
  }

  const guessedShopIds = scanAllShopIdsFromLocal();
  if (guessedShopIds.length) {
    clearShopsData(guessedShopIds);
    const map = getShopsMap();
    guessedShopIds.forEach(id => delete map[id]);
    saveShopsMap(map);
  }

  ["CFP_auth_token", "account", "role", "currentShopId"].forEach(k => localStorage.removeItem(k));
}

/** 從 accounts_meta 推得角色（後端回不來時使用） */
function inferRoleFromLocal(account: string | null): Role {
  if (!account) return "None";
  const meta = getAccountsMeta()[account];
  return (meta?.role as Role) || "None";
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady]   = useState(false);
  const [account, setAcc]   = useState<string | null>(loadAccount() || null);
  const [role, setRole]     = useState<Role>("None");
  const [token, setToken]   = useState<string | null>(localStorage.getItem(TOKEN_KEY));

  /** 重新讀取目前登入者；盡量從後端拿，失敗時回退本機 */
  const refresh = async () => {
    try {
      const me = await auth.getMe();
      saveCurrentAccount(me.username);
      saveRole(me.type as Role);
      setAcc(me.username);
      setRole(me.type as Role);
      setToken(localStorage.getItem(TOKEN_KEY));
    } catch {
      const acc = loadAccount() || null;
      const fallbackRole = inferRoleFromLocal(acc);
      setAcc(acc);
      setRole(fallbackRole);
      setToken(localStorage.getItem(TOKEN_KEY));
    }
  };

  useEffect(() => {
    (async () => {
      await refresh();
      setReady(true); // ready=已判斷完登入狀態
    })();
  }, []);

  /** 登入後一定補齊角色（先 getMe，失敗用 accounts_meta） */
  const login = async (accountInput: string, password: string) => {
    const res = await auth.login(accountInput, password);
    localStorage.setItem(TOKEN_KEY, res.token);
    saveCurrentAccount(res.username);

    // 盡量從後端取得角色
    let finalRole: Role = "None";
    try {
      const me = await auth.getMe();
      finalRole = (me.type as Role) || "None";
    } catch {
      // 後端沒有 type，就從本機 accounts_meta 補
      finalRole = inferRoleFromLocal(res.username);
    }

    saveRole(finalRole);
    setAcc(res.username);
    setRole(finalRole);
    setToken(res.token);
  };

  /** 註冊後也補齊角色（同上） */
  const signup = async (opts: { account: string; password: string; role: Role; shopName?: string }) => {
    const res = await auth.signup(opts);
    localStorage.setItem(TOKEN_KEY, res.token);
    saveCurrentAccount(res.username);

    let finalRole: Role = "None";
    try {
      const me = await auth.getMe();
      finalRole = (me.type as Role) || opts.role || "None";
    } catch {
      finalRole = opts.role || inferRoleFromLocal(res.username);
    }

    saveRole(finalRole);
    setAcc(res.username);
    setRole(finalRole);
    setToken(res.token);
  };

  const logout = async (fullWipe?: boolean) => {
    try { await auth.logout(); } catch {}
    localStorage.removeItem(TOKEN_KEY);
    softLogout();
    clearCurrentAccount();
    if (fullWipe) {
      hardAppReset();
    }
    setAcc(null);
    setRole("None");
    setToken(null);
  };

  const chooseRole = (r: Role) => {
    if (!account) return;
    setRoleOf(account, r);
    saveRole(r);
    setRole(r);
  };

  const removeMyAccount = async () => {
    const me = account;
    if (!me) return;
    try {
      const anyAuth: any = auth as any;
      if (typeof anyAuth.deleteMe === "function") {
        await anyAuth.deleteMe();
      } else if (typeof anyAuth.deleteUser === "function") {
        await anyAuth.deleteUser(me);
      }
    } catch {
      // ignore
    }
    wipeLocalDataForAccount(me);
    setAcc(null);
    setRole("None");
    setToken(null);
  };

  const value = useMemo<UserCtx>(() => ({
    ready, account, role, token,
    login, signup, logout, chooseRole, refresh, removeMyAccount
  }), [ready, account, role, token]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
