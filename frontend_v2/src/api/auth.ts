// ====================================================================
// Auth API bindings
// - Aligns with backend /auth routes (JSON payload)
// - Saves tokens to localStorage on login/register
// - Provides /me, /me (PUT), /refresh, and local logout
// ====================================================================
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
  organization_name?: string;     // required when role = "shop"
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
}

// Save tokens to localStorage
function saveTokens(t: { access_token?: string; refresh_token?: string }) {
  if (t.access_token) localStorage.setItem("access_token", t.access_token);
  if (t.refresh_token) localStorage.setItem("refresh_token", t.refresh_token);
}

// Clear tokens from localStorage
export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

// POST /auth/login
export async function login(p: LoginRequest): Promise<LoginResponse> {
  const res = await http.post<LoginResponse>("/api/auth/login", {
    account: p.account,
    password: p.password,
  });
  saveTokens(res);
  return res;
}

// POST /auth/register
export async function register(p: RegisterRequest): Promise<LoginResponse> {
  const res = await http.post<LoginResponse>("/api/auth/register", p);
  saveTokens(res);
  return res;
}

// GET /auth/me
export async function me(): Promise<MeResponse> {
  return http.get<MeResponse>("/api/auth/me");
}

// PUT /auth/me
export async function updateMe(p: {
  user_type: BackendUserType;
  organization_name?: string;
}): Promise<{ message: string }> {
  return http.put<{ message: string }>("/api/auth/me", p);
}

// POST /auth/refresh
export async function refresh(): Promise<{ access_token: string }> {
  return http.post<{ access_token: string }>("/api/auth/refresh", {});
}

// Local-only logout (backend has no logout route)
export async function logout(): Promise<void> {
  clearTokens();
}

export const auth = { login, register, me, updateMe, refresh, logout };
