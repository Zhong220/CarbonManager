import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import styled from "styled-components";

const Menu = styled.ul`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 6px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.1);
  list-style: none;
  padding: 6px 0;
  min-width: 140px;
  z-index: 3000;

  li {
    padding: 10px 14px;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.15s;

    &:hover {
      background: #f3f3f3;
    }

    &.danger {
      color: #d33;
      font-weight: 500;
    }
  }
`;

export default function DropdownMenu({
  open,
  onClose,
  anchorRef,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: { current: HTMLElement | null };
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!open) return null;

  const rect = anchorRef.current?.getBoundingClientRect();
  const style: React.CSSProperties = rect
    ? {
        position: "absolute",
        top: rect.bottom + 6,
        left: rect.right - 140, // dropdown 寬度補正
      }
    : {};

  return ReactDOM.createPortal(
    <Menu ref={ref} style={style}>
      {children}
    </Menu>,
    document.body
  );
}
