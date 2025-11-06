// ===============================================================
// src/api/auth.ts
// 對齊後端 routes/auth.py：JSON payload、固定鍵名 account/password
// /auth/register, /auth/login, /auth/me, /auth/me[PUT], /auth/refresh
// ===============================================================
import { http } from "./http";

export type BackendUserType = "shop" | "customer";

export interface LoginRequest {
  account: string;
  password: string;
}
export interface RegisterRequest {
  account: string;
  password: string;
  user_name: string;
  role: BackendUserType;          // "shop" | "customer"
  organization_name?: string;     // role=shop 必填
}

export interface LoginResponse {
  status_message?: string;
  account: string;
  access_token: string;
  refresh_token?: string;
  role: BackendUserType;
  current_organization_id: number | null;
}

export interface MeResponse {
  id: number;
  account: string;
  user_name: string;
  user_type: BackendUserType;
  organization_id: number | null;
  organization_name?: string | null;
  // 後端 me() 會 pop 掉 password_hash，不會出現這欄
}

function saveTokens(t: { access_token?: string; refresh_token?: string }) {
  if (t.access_token) localStorage.setItem("access_token", t.access_token);
  if (t.refresh_token) localStorage.setItem("refresh_token", t.refresh_token);
}
export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export async function login(p: LoginRequest): Promise<LoginResponse> {
  const res = await http.post<LoginResponse>("/api/auth/login", {
    account: p.account,
    password: p.password,
  });
  saveTokens(res);
  return res;
}

export async function register(p: RegisterRequest): Promise<LoginResponse> {
  // 後端 register 僅接受 JSON（force=True），鍵名固定
  const res = await http.post<LoginResponse>("/api/auth/register", p);
  saveTokens(res);
  return res;
}

export async function me(): Promise<MeResponse> {
  return http.get<MeResponse>("/api/auth/me");
}

export async function updateMe(p: {
  user_type: BackendUserType;
  organization_name?: string;
}): Promise<{ message: string }> {
  return http.put<{ message: string }>("/api/auth/me", p);
}

export async function refresh(): Promise<{ access_token: string }> {
  return http.post<{ access_token: string }>("/api/auth/refresh", {});
}

export async function logout(): Promise<void> {
  clearTokens(); // 後端沒有專屬登出，比照常見做法清本地 token
}

export const auth = { login, register, me, updateMe, refresh, logout };
