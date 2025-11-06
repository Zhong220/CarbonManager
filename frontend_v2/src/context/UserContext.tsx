import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { http } from "@/api/http";
import {
  auth,
  BackendUserType,
  MeResponse,
  RegisterRequest,
  clearTokens,
} from "@/api/auth";

type UserState = MeResponse | null;

type UserCtx = {
  ready: boolean;
  user: UserState;
  isAuthed: boolean;
  login: (account: string, password: string) => Promise<void>;
  register: (p: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  updateMe: (p: { user_type: BackendUserType; organization_name?: string }) => Promise<void>;
};

const Ctx = createContext<UserCtx | null>(null);
export const useUser = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("UserContext not mounted");
  return c;
};

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserState>(null);

  const hasAccessToken = () => !!localStorage.getItem("access_token");

  /** 只在真的有 token 才打 /auth/me */
  const fetchMe = useCallback(async () => {
    if (!hasAccessToken()) {
      setUser(null);
      return;
    }
    try {
      const me = await auth.me();
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  /** 全域 401：清 token＋清 user，避免無限循環 */
  useEffect(() => {
    const handler = () => {
      clearTokens();
      setUser(null);
      setReady(true);
    };
    http.setOnUnauthorized(handler);
    return () => http.setOnUnauthorized(null);
  }, []);

  /** 首次掛載：沒 token 直接 ready；有 token 嘗試抓 me */
  useEffect(() => {
    if (!hasAccessToken()) {
      setUser(null);
      setReady(true);
      return;
    }
    fetchMe().finally(() => setReady(true));
  }, [fetchMe]);

  const login = useCallback(async (account: string, password: string) => {
    await auth.login({ account, password });
    await fetchMe();
  }, [fetchMe]);

  const register = useCallback(async (p: RegisterRequest) => {
    await auth.register(p);
    await fetchMe();
  }, [fetchMe]);

  const updateMe = useCallback(async (p: { user_type: BackendUserType; organization_name?: string }) => {
    const me = await auth.updateMe(p);
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    await auth.logout();
    setUser(null);
  }, []);

  const value = useMemo<UserCtx>(() => ({
    ready,
    user,
    isAuthed: !!user,
    login,
    register,
    logout,
    fetchMe,
    updateMe,
  }), [ready, user, login, register, logout, fetchMe, updateMe]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
