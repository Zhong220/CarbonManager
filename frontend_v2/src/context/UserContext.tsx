import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import {
  // account / role / shop 狀態
  getAccount as loadAccount,
  clearAccount as clearCurrentAccount,
  setRoleOf,
  Role,
  softLogout,
  setAccount as saveCurrentAccount,
  setRole as saveRole,
  getCurrentShopId as loadCurrentShopId,
  setCurrentShopId as saveCurrentShopId,

  // 資料面工具
  deleteAccountCompletely,
  clearShopsData,
  hardAppReset,
  getAccountsMeta,
  getShopsMap,
  saveShopsMap,
} from "@/utils/storage";

import { auth } from "@/api";

const TOKEN_KEY = "CFP_auth_token";

type UserCtx = {
  ready: boolean;
  account: string | null;
  role: Role;
  token: string | null;
  currentShopId: string | null;

  // 動作
  login: (account: string, password: string) => Promise<void>;
  signup: (opts: { account: string; password: string; role: Role; shopName?: string }) => Promise<void>;
  logout: (fullWipe?: boolean) => Promise<void>;
  chooseRole: (r: Role) => void;
  chooseShop: (shopId: string | null) => void;
  refresh: () => Promise<void>;
  removeMyAccount: () => Promise<void>;
};

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
    guessedShopIds.forEach((id) => delete map[id]);
    saveShopsMap(map);
  }

  ["CFP_auth_token", "account", "role", "currentShopId"].forEach((k) =>
    localStorage.removeItem(k)
  );
}

/** 從 accounts_meta 推得角色（後端回不來時使用） */
function inferRoleFromLocal(account: string | null): Role {
  if (!account) return "None";
  const meta = getAccountsMeta()[account];
  return (meta?.role as Role) || "None";
}

/** 從 accounts_meta 推得 shopId（登入/註冊後，若後端沒給 shopId 時使用） */
function inferShopFromLocal(account: string | null): string | null {
  if (!account) return null;
  const meta = getAccountsMeta()[account];
  return meta?.currentShopId ?? meta?.shopIds?.[0] ?? null;
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [account, setAcc] = useState<string | null>(loadAccount() || null);
  const [role, setRole] = useState<Role>("None");
  const [token, setToken] = useState<string | null>(localStorage.getItem(TOKEN_KEY));
  const [currentShopId, setShopId] = useState<string | null>(loadCurrentShopId() ?? null);

  /** 把 localStorage → state（初始化 / 手動刷新） */
  const refresh = useCallback(async () => {
    try {
      const me = await auth.getMe(); // 後端若可取得：{ username, type, currentShopId? ... }
      saveCurrentAccount(me.username);
      if (me.type) saveRole(me.type as Role);
      if (me.currentShopId) saveCurrentShopId(me.currentShopId);

      setAcc(me.username);
      setRole((me.type as Role) || inferRoleFromLocal(me.username));
      setShopId(me.currentShopId ?? loadCurrentShopId() ?? inferShopFromLocal(me.username));
      setToken(localStorage.getItem(TOKEN_KEY));
    } catch {
      const acc = loadAccount() || null;
      setAcc(acc);
      setRole(inferRoleFromLocal(acc));
      setShopId(loadCurrentShopId() ?? inferShopFromLocal(acc));
      setToken(localStorage.getItem(TOKEN_KEY));
    }
  }, []);

  // 初始化：判斷一次登入狀態
  useEffect(() => {
    (async () => {
      await refresh();
      setReady(true);
    })();
  }, [refresh]);

  // 跨分頁/同頁其他程式變更 localStorage 時，與 Context 同步
  useEffect(() => {
    const onStorage = () => {
      setAcc(loadAccount() || null);
      setRole(inferRoleFromLocal(loadAccount() || null));
      setShopId(loadCurrentShopId() ?? inferShopFromLocal(loadAccount() || null));
      setToken(localStorage.getItem(TOKEN_KEY));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /** 登入：同步 token / account / role / shopId 到 localStorage + Context */
  const login = useCallback(async (accountInput: string, password: string) => {
    const res = await auth.login(accountInput, password); // 期望回 { username, token, ... }
    localStorage.setItem(TOKEN_KEY, res.token);
    saveCurrentAccount(res.username);

    // 後端優先，其次本機
    let finalRole: Role = "None";
    let finalShop: string | null = null;

    try {
      const me = await auth.getMe();
      finalRole = (me.type as Role) || inferRoleFromLocal(res.username);
      finalShop = me.currentShopId ?? inferShopFromLocal(res.username);
      if (me.currentShopId) saveCurrentShopId(me.currentShopId);
    } catch {
      finalRole = inferRoleFromLocal(res.username);
      finalShop = inferShopFromLocal(res.username);
    }

    saveRole(finalRole);
    if (finalShop) saveCurrentShopId(finalShop);

    setAcc(res.username);
    setRole(finalRole);
    setShopId(finalShop ?? null);
    setToken(res.token);
  }, []);

  /** 註冊：同理，註冊成功後也視為登入（若你不想自動登入，可把 setXXX 這段抽成可選） */
  const signup = useCallback(
    async (opts: { account: string; password: string; role: Role; shopName?: string }) => {
      const res = await auth.signup(opts); // 期望回 { username, token, ... }
      localStorage.setItem(TOKEN_KEY, res.token);
      saveCurrentAccount(res.username);

      let finalRole: Role = "None";
      let finalShop: string | null = null;

      try {
        const me = await auth.getMe();
        finalRole = (me.type as Role) || opts.role || inferRoleFromLocal(res.username);
        finalShop = me.currentShopId ?? inferShopFromLocal(res.username);
        if (me.currentShopId) saveCurrentShopId(me.currentShopId);
      } catch {
        finalRole = opts.role || inferRoleFromLocal(res.username);
        finalShop = inferShopFromLocal(res.username);
      }

      saveRole(finalRole);
      if (finalShop) saveCurrentShopId(finalShop);

      setAcc(res.username);
      setRole(finalRole);
      setShopId(finalShop ?? null);
      setToken(res.token);
    },
    []
  );

  /** 登出：清 localStorage + Context（讓 HomeGate 立刻看到未登入） */
  const logout = useCallback(async (fullWipe?: boolean) => {
    try {
      await auth.logout();
    } catch {
      /* ignore */
    }
    localStorage.removeItem(TOKEN_KEY);
    softLogout();        // 清 account/role/currentShopId 等
    clearCurrentAccount();

    if (fullWipe) {
      hardAppReset();    // 清更乾淨（僅保留遷移旗標）；或你可用 hardAppNuke()
    }

    setAcc(null);
    setRole("None");
    setShopId(null);
    setToken(null);
  }, []);

  /** 切換角色（本地 Demo 用；正式版應由後端權限決定） */
  const chooseRole = useCallback((r: Role) => {
    if (!account) return;
    setRoleOf(account, r);
    saveRole(r);
    setRole(r);
  }, [account]);

  /** 切換店鋪（讓畫面與 Router 都能即時反應） */
  const chooseShop = useCallback((shopId: string | null) => {
    if (shopId) saveCurrentShopId(shopId);
    else localStorage.removeItem("currentShopId");
    setShopId(shopId);
  }, []);

  /** 刪除自己的帳號（本地資料也清掉） */
  const removeMyAccount = useCallback(async () => {
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
    setShopId(null);
    setToken(null);
  }, [account]);

  const value = useMemo<UserCtx>(
    () => ({
      ready,
      account,
      role,
      token,
      currentShopId,
      login,
      signup,
      logout,
      chooseRole,
      chooseShop,
      refresh,
      removeMyAccount,
    }),
    [ready, account, role, token, currentShopId, login, signup, logout, chooseRole, chooseShop, refresh, removeMyAccount]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
