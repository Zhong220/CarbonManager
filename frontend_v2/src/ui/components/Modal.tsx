// src/ui/components/Modal.tsx
import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import * as S from "./Modal.styles";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
};

export default function Modal({ open, onClose, children, ariaLabel }: ModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <S.Backdrop onClick={onClose} aria-hidden>
      <S.Card
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? "Dialog"}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </S.Card>
    </S.Backdrop>,
    document.body
  );
}
