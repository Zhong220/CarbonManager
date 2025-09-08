import React, { createContext, useContext, useState } from "react";
import {
  getAccount as loadAccount,
  getAccountsMeta,
  createAccount,
  accountExists,
  setAccount as saveCurrentAccount,
  clearAccount as clearCurrentAccount,
  setRoleOf,
  Role,
  softLogout,
} from "../utils/storage";

/* -------- Context -------- */
interface UserCtx {
  account: string | null;
  role: Role;
  login: (account?: string, password?: string) => void;
  logout: () => void;
  chooseRole: (r: Role) => void;
}

const Ctx = createContext<UserCtx | null>(null);
export const useUser = () => useContext(Ctx)!;

export function UserProvider({ children }: { children: React.ReactNode }) {
  // 初始化：從 localStorage + accounts_meta 帶出帳號與角色
  const acc = loadAccount();
  const metas = getAccountsMeta();
  const meta = acc ? metas[acc] : null;

  const [account, setAccount] = useState<string | null>(acc);
  const [role, setRole] = useState<Role>(meta?.role || "None");

  /** 登入（簡化版：直接用帳號名稱；有需要可加密碼驗證） */
  function login(inputAcc?: string, _password?: string) {
    let accName = inputAcc?.trim();
    if (!accName) {
      accName = window.prompt("請輸入帳號（可用 email 或暱稱）：")?.trim() || "";
      if (!accName) return;
    }

    // 如果帳號不存在，建立一個新帳號（預設 None 身份）
    if (!accountExists(accName)) {
      createAccount(accName, "", "None");
    }

    saveCurrentAccount(accName);
    const metas = getAccountsMeta();
    const meta = metas[accName];

    setAccount(accName);
    setRole(meta?.role || "None");
  }

  /** 登出 → 清掉 current account + 回到 None */
  function logout() {
    softLogout();
    clearCurrentAccount();
    setAccount(null);
    setRole("None");
  }

  /** 修改當前帳號的角色（會寫進 accounts_meta） */
  function chooseRole(r: Role) {
    if (!account) return;
    setRoleOf(account, r);
    setRole(r);
  }

  const value: UserCtx = { account, role, login, logout, chooseRole };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
