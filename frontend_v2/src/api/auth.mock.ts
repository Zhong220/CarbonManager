import {
  verifyLogin,
  accountExists,
  createAccount,
  setAccount as saveCurrentAccount,
  getRole as loadRole,
  setRole as saveRole,
  listMyShops,
  setCurrentShopId,
  createShop,
  Role as StorageRole,
} from "@/utils/storage";
import type { AuthClient, LoginResp, MeResp, UserType } from "./auth.contract";

const TOKEN_KEY = "CFP_auth_token";
const genToken = () => "t_" + Math.random().toString(36).slice(2) + Date.now().toString(36);

export const authMock: AuthClient = {
  async login(account: string, password: string): Promise<LoginResp> {
    if (!accountExists(account) || !verifyLogin(account, password)) {
      throw new Error("帳號或密碼錯誤");
    }
    const token = genToken();
    localStorage.setItem(TOKEN_KEY, token);
    saveCurrentAccount(account);
    const role = (loadRole() as StorageRole) || "Farmer";
    saveRole(role);
    const shops = listMyShops(account);
    if (shops.length > 0) setCurrentShopId(shops[0].id);
    return { token, username: account, type: role as UserType };
  },

  async signup({ account, password, role, shopName }): Promise<LoginResp> {
    if (role === "Farmer" && !shopName?.trim()) throw new Error("請輸入茶行名稱");
    if (accountExists(account)) throw new Error("帳號已存在");
    createAccount(account, password, role as StorageRole);
    saveCurrentAccount(account);
    saveRole(role as StorageRole);
    if (role === "Farmer" && shopName?.trim()) {
      const shop = createShop(shopName.trim(), account);
      setCurrentShopId(shop.id);
    }
    const token = genToken();
    localStorage.setItem(TOKEN_KEY, token);
    return { token, username: account, type: role };
  },

  async getMe(): Promise<MeResp> {
    const token = localStorage.getItem(TOKEN_KEY);
    const username = localStorage.getItem("account") || "";
    const type = (localStorage.getItem("role") as UserType) || "None";
    if (!token || !username || type === "None") throw new Error("Unauthorized");
    const shops = listMyShops(username).map(s => ({ id: s.id, name: s.name }));
    return { username, type, shops };
  },

  async logout(): Promise<void> {
    localStorage.removeItem(TOKEN_KEY);
  },
};
