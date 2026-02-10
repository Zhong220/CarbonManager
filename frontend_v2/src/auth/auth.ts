// src/auth/auth.ts
// Purpose: tiny helpers around session & logout, no React dependency.

import { auth } from "@/api"; // 你現在在 UserContext 用的那個
import {
  softLogout,          // 清 account/role/currentShopId 等 session 面的 localStorage
  hardAppReset,        // 全清（僅保留遷移旗標）；開發維運時才用
  clearAccount as clearCurrentAccount,
} from "@/utils/storage";

/** Session keys kept in localStorage */
export const TOKEN_KEY = "CFP_auth_token";
export const SESSION_KEYS = [TOKEN_KEY, "account", "role", "currentShopId"] as const;

/** Token helpers */
export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/** Is user considered authenticated on the client? (very lightweight check) */
export const isAuthenticated = () => !!getToken();

/** Clear only client session state (no data wipe). */
export function clearClientSession() {
  clearToken();
  softLogout();
  clearCurrentAccount();
}

/**
 * Client-only logout flow (no server call).
 * Use this in places where you don't have React context at hand.
 * Prefer calling `useUser().logout()` inside React components.
 */
export function logoutClientOnly(options?: { redirect?: string; fullWipe?: boolean }) {
  const { redirect = "/", fullWipe = false } = options || {};
  clearClientSession();
  if (fullWipe) {
    // Dangerous: wipe almost everything (kept for dev/ops)
    hardAppReset();
  }
  // Leave navigation decision to caller if they want,
  // but default to redirecting to entry/login page.
  if (redirect) window.location.href = redirect;
}

/**
 * Logout with server best-effort, then clear client session.
 * Safe even if the server endpoint is not available (errors ignored).
 */
export async function logoutWithServer(options?: { redirect?: string; fullWipe?: boolean }) {
  try {
    await auth.logout(); // 後端可選：讓 refresh token 作廢 / 黑名單
  } catch {
    // ignore network / 404 / not implemented
  } finally {
    logoutClientOnly(options);
  }
}

/**
 * Optional: apply/remove Authorization header to your http client.
 * 呼叫時機：登入後或登出後。
 */
export function applyAuthHeader(http: { defaults?: any }) {
  const tk = getToken();
  if (tk && http?.defaults) {
    http.defaults.headers = http.defaults.headers || {};
    http.defaults.headers.common = http.defaults.headers.common || {};
    http.defaults.headers.common.Authorization = `Bearer ${tk}`;
  }
}
export function removeAuthHeader(http: { defaults?: any }) {
  if (http?.defaults?.headers?.common) {
    delete http.defaults.headers.common.Authorization;
  }
}
