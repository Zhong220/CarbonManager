import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import * as S from "./Modal.styles";

type ModalSize = "sm" | "md" | "lg";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
  size?: ModalSize; // 控制卡片最大寬
};

const SIZE_MAP: Record<ModalSize, number> = {
  sm: 360,
  md: 520,
  lg: 640,
};

export default function Modal({
  open,
  onClose,
  children,
  ariaLabel,
  size = "md",
}: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const appRoot = document.getElementById("root");

  // ESC 關閉
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // inert 背景 + 焦點管理 + 鎖 body 捲動
  useEffect(() => {
    if (!appRoot) return;
    if (!open) {
      appRoot.removeAttribute("inert");
      return;
    }

    // blur 目前焦點避免 aria 衝突
    (document.activeElement as HTMLElement | null)?.blur?.();
    appRoot.setAttribute("inert", "");

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // 將焦點移到 Modal 卡片
    setTimeout(() => cardRef.current?.focus(), 0);

    return () => {
      appRoot.removeAttribute("inert");
      document.body.style.overflow = prevOverflow;
    };
  }, [open, appRoot]);

  if (!open) return null;

  return createPortal(
    <S.Backdrop onClick={onClose}>
      <S.Card
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? "Dialog"}
        tabIndex={-1}
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        $maxW={SIZE_MAP[size]}
      >
        {/* 由內層垂直滾動，避免水平溢出 */}
        <S.ScrollArea>{children}</S.ScrollArea>
      </S.Card>
    </S.Backdrop>,
    document.body
  );
}
