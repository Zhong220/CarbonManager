import { http } from "./http";
import type { AuthClient, LoginResp, MeResp, UserType } from "./auth.contract";

export const authHttp: AuthClient = {
  async login(account: string, password: string): Promise<LoginResp> {
    const { data } = await http.post<LoginResp>("/auth/login", { account, password });
    // 前端通常會把 token 存起來（也可改成 httpOnly cookie 策略）
    localStorage.setItem("CFP_auth_token", data.token);
    return data;
  },

  async signup(input: { account: string; password: string; role: UserType; shopName?: string }): Promise<LoginResp> {
    const { data } = await http.post<LoginResp>("/auth/signup", input);
    localStorage.setItem("CFP_auth_token", data.token);
    return data;
  },

  async getMe(): Promise<MeResp> {
    const { data } = await http.get<MeResp>("/users/me");
    return data;
  },

  async logout(): Promise<void> {
    try { await http.post("/auth/logout", {}); } catch {}
    localStorage.removeItem("CFP_auth_token");
  },
};
