import React, { useRef, useState } from "react";
import DropdownMenu from "@/ui/components/DropdownMenu";
import { WhiteButton } from "@/ui/primitives/Button";
import { useNavigate } from "react-router-dom";

import { useUser } from "@/context/UserContext"; // ✅ 用 Context
import {
  getAccount as getAccountFromStorage,
  deleteAccount as deleteAccountFromStorage,
  hardAppReset as hardAppResetStorage,
  softLogout as softLogoutStorage, // 備援用
} from "@/utils/storage";

/**
 * 帳號選單（右上角 ☰）
 * - 登出：清除登入狀態並強制回到歡迎頁
 * - 刪除帳號：二次確認後刪除資料並強制回到歡迎頁
 */
export default function AccountMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // ✅ 以 Context 為主（確保全站 state 一致）
  const { account, logout, removeMyAccount } = useUser();
  const fallbackAcc = getAccountFromStorage();
  const acc = account ?? fallbackAcc ?? "";

  /** 登出：優先呼叫 Context，最後用硬導向確保回首頁 */
  const handleLogout = async () => {
    try {
      if (logout) {
        await Promise.resolve(logout());        // 清空 Context + localStorage
      } else {
        softLogoutStorage();                    // 備援：只清本機
      }
    } finally {
      setOpen(false);
      // ✅ 用硬導向確保重新 mount（避免 Router 沒重繪）
      window.location.replace("/");
      // 若你想保留單頁跳轉，也可用：
      // navigate("/", { replace: true });
    }
  };

  /** 刪除帳號：二次確認，刪除後強制回首頁 */
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
        // 備援路徑：直接刪本機資料
        deleteAccountFromStorage(acc);
        hardAppResetStorage?.();
      }
    } catch (e) {
      console.error(e);
      alert("刪除帳號時發生錯誤，已嘗試清除登入狀態。");
      softLogoutStorage();
    } finally {
      setOpen(false);
      window.location.replace("/"); // ✅ 強制回歡迎頁
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
