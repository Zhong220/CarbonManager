// src/ui/components/AccountMenu.tsx
import React, { useRef, useState } from "react";
import DropdownMenu from "@/ui/components/DropdownMenu";
import { WhiteButton } from "@/ui/primitives/Button";
import { useNavigate } from "react-router-dom";

import { useUser } from "@/context/UserContext"; // ✅ Use Context first
import {
  getAccount as getAccountFromStorage,
  deleteAccountCompletely as deleteAccountFromStorage, // ✅ renamed in new storage.ts
  hardAppReset as hardAppResetStorage,
  softLogout as softLogoutStorage, // fallback only
} from "@/utils/storage";

/**
 * Account menu (top-right ☰)
 * - Logout: clear auth state and force return to welcome page
 * - Delete account: double confirm, then wipe local data and force return to welcome page
 */
export default function AccountMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // ✅ Prefer Context (keeps global app state in sync)
  const { account, logout, removeMyAccount } = useUser();
  const fallbackAcc = getAccountFromStorage();
  const acc = account ?? fallbackAcc ?? "";

  /** Logout: prefer Context, fallback to local-only; always hard-redirect home */
  const handleLogout = async () => {
    try {
      if (logout) {
        await Promise.resolve(logout()); // clear Context + storage token
      } else {
        softLogoutStorage(); // fallback: local only
      }
    } finally {
      setOpen(false);
      // Hard redirect to ensure a clean remount (avoids stale router state)
      window.location.replace("/");
      // If you prefer SPA navigation, you can use:
      // navigate("/", { replace: true });
    }
  };

  /** Delete account: double-confirm, then wipe, then hard-redirect home */
  const handleDelete = async () => {
    if (!acc) return;
    const ok1 = confirm("確定要刪除此帳號嗎？此動作將刪除此帳號底下的商店、商品、紀錄與分類，無法復原。");
    if (!ok1) return;
    const ok2 = confirm("再次確認：真的要永久刪除此帳號嗎？");
    if (!ok2) return;

    try {
      if (removeMyAccount) {
        await Promise.resolve(removeMyAccount());
      } else {
        // Fallback path: wipe local data
        deleteAccountFromStorage(acc);
        hardAppResetStorage?.();
      }
    } catch (e) {
      console.error(e);
      alert("刪除帳號時發生錯誤，已嘗試清除登入狀態。");
      softLogoutStorage();
    } finally {
      setOpen(false);
      window.location.replace("/"); // Force return to welcome page
    }
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <WhiteButton
        ref={btnRef}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{ gap: 6 }}
      >
        <span aria-hidden>☰</span>
        <span>帳號</span>
      </WhiteButton>

      <DropdownMenu
        anchorRef={{ current: btnRef.current }}
        open={open}
        onClose={() => setOpen(false)}
      >
        <li
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleLogout();
          }}
        >
          登出
        </li>
        <li
          className="danger"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDelete();
          }}
        >
          刪除帳號
        </li>
      </DropdownMenu>
    </div>
  );
}
