// src/ui/components/AccountMenu.tsx
import React, { useRef, useState } from "react";
import DropdownMenu from "@/ui/components/DropdownMenu";
import { getAccount, softLogout, deleteAccount } from "@/utils/storage";
import { useNavigate } from "react-router-dom";
import { WhiteButton } from "@/ui/primitives/Button";

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
      navigate("/", { replace: true });
    }
  };

  const handleDelete = () => {
    if (!acc) return;
    const ok1 = confirm(
      "確定要刪除此帳號嗎？此動作將刪除此帳號底下的商店、商品、紀錄與分類，無法復原。"
    );
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
      {/* ✅ 用 GhostButton，會繼承 ButtonBase 的高度/排版，不截字 */}
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
