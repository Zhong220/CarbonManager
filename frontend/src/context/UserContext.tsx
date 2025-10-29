// src/context/UserContext.tsx
import React, { createContext, useContext, useState } from "react";
import { getAccount as loadAccount, getRole as loadRole } from "../utils/storage";

/* -------- Context -------- */
const Ctx = createContext<any>(null);
export const useUser = () => useContext(Ctx);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<string | null>(loadAccount());
  const [role,    setRole]    = useState<string>(loadRole());   // 預設 "None"

  function login() {
    const input = window.prompt("請輸入帳號（可用 email 或暱稱）：")?.trim();
    if (!input) return;                      // 按取消或空白 → 不登入
    localStorage.setItem("account", input);  // 寫入 localStorage
    setAccount(input);
  }

  function logout() {
    localStorage.removeItem("account");
    localStorage.removeItem("role");
    setAccount(null);
    setRole("None");
  }

  function chooseRole(r: "Consumer" | "Farmer") {
    localStorage.setItem("role", r);
    setRole(r);
  }

  const value = { account, role, login, logout, chooseRole };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
