// src/ui/components/AccountMenu.tsx
import React, { useRef, useState } from "react";
import DropdownMenu from "@/ui/components/DropdownMenu";
import { getAccount, softLogout, deleteAccount } from "@/utils/storage";
import { useNavigate } from "react-router-dom";

export default function AccountMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const acc = getAccount();

  const handleLogout = () => {
    try {
      softLogout();
    } finally {
      setOpen(false);
      navigate("/", { replace: true }); // 回到歡迎頁
    }
  };

  const handleDelete = () => {
    if (!acc) return;
    const ok1 = confirm("確定要刪除此帳號嗎？此動作將刪除此帳號底下的商店、商品、紀錄與分類，無法復原。");
    if (!ok1) return;
    const ok2 = confirm("再次確認：真的要永久刪除此帳號嗎？");
    if (!ok2) return;

    try {
      deleteAccount(acc);
    } catch (e) {
      console.error(e);
      alert("刪除帳號時發生錯誤，已嘗試清除登入狀態。");
      softLogout();
    } finally {
      setOpen(false);
      navigate("/", { replace: true });
    }
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={btnRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        // 🔶 與「分類管理」一致的尺寸與字型
        style={{
          fontSize: 14,
          lineHeight: 1.4,
          padding: "6px 14px",
          border: "1px solid #ccd6cc",
          borderRadius: 8,
          background: "#fff",
          color: "#2c3e2c",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          userSelect: "none",
        }}
      >
        ☰ 帳號
      </button>

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
