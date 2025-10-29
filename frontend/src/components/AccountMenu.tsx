import React, { useEffect, useRef, useState } from "react";

interface AccountMenuProps {
  account: string;
  onLogout: () => void;
  onDelete: () => void;
  /** 固定位置：'top-right' | 'bottom-right' */
  anchor?: "top-right" | "bottom-right";
}

const WOOD = {
  panelBg: "linear-gradient(145deg,#EFE8DF 0%, #E2D3C1 100%)",
  text: "#4C3A28",
  danger: "#E4B0A1",
  triggerBg: "linear-gradient(135deg,#E6DED2 0%, #CCBBAA 100%)",
};

const AccountMenu: React.FC<AccountMenuProps> = ({
  account,
  onLogout,
  onDelete,
  anchor = "top-right",
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 點擊外部關閉
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const posStyle =
    anchor === "bottom-right"
      ? { bottom: 16, right: 18 }
      : { top: 8, right: 18 };

  return (
    <div
      ref={wrapRef}
      style={{
        position: "fixed",
        zIndex: 1400,
        ...posStyle,
      }}
    >
      {/* 主要觸發按鈕（固定寬度不會因展開而移動） */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          padding: "6px 14px",
          fontSize: 13,
          color: WOOD.text,
          border: "none",
          borderRadius: 12,
          cursor: "pointer",
          background: WOOD.triggerBg,
          boxShadow: "0 2px 5px rgba(0,0,0,.16)",
          minWidth: 112, // 固定寬度避免文字變動造成跳動
          textAlign: "center",
        }}
      >
        👤 帳號管理
      </button>

      {/* 彈出選單：用 absolute，相對 wrapper，不會推擠版面 */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: anchor === "top-right" ? "calc(100% + 8px)" : "auto",
            bottom: anchor === "bottom-right" ? "calc(100% + 8px)" : "auto",
            right: 0,
            background: WOOD.panelBg,
            borderRadius: 16,
            boxShadow: "0 8px 22px rgba(0,0,0,.22)",
            padding: "12px 14px",
            minWidth: 160,
            overflow: "hidden",
          }}
        >

          <button
            onClick={() => {
              setOpen(false);
              window.location.href = "/notes";
            }}
            style={menuBtnStyle}
          >
            📝 記事本
          </button>

          <div style={{ height: 1, background: "rgba(0,0,0,.08)", margin: "6px 0 8px" }} />

          {/* 登出 */}
          <button
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            style={menuBtnStyle}
          >
            🔄 登出
          </button>

          <div
            style={{
              height: 1,
              background: "rgba(0,0,0,.08)",
              margin: "6px 0 8px",
            }}
          />

          {/* 刪除帳號 */}
          <button
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            style={{ ...menuBtnStyle, color: "#8A2F2F" }}
          >
            🗑 刪除帳號
          </button>
        </div>
      )}
    </div>
  );
};

const menuBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 0",
  background: "none",
  border: "none",
  fontSize: 13,
  color: WOOD.text,
  cursor: "pointer",
  textAlign: "left",
};

export default AccountMenu;
