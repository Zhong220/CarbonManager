// src/ui/components/RoleDropdown.tsx
import React, { useState, useRef, useEffect } from "react";
import styled from "styled-components";

const DropdownWrapper = styled.div`
  position: relative;
  width: 100%;
  font-size: 14px;
`;

const DropdownButton = styled.button`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: #fff;
  text-align: left;
  font-size: inherit;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;

  &:after {
    content: "▾";
    font-size: 12px;
    color: #666;
  }
`;

const DropdownList = styled.ul`
  position: absolute;
  top: 110%;
  left: 0;
  right: 0;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 20;

  /* 改良點：限制高度，避免整個頁面被撐開 */
  max-height: 150px;
  overflow-y: auto;

  font-size: inherit;
`;

const DropdownItem = styled.li`
  padding: 8px 12px;
  cursor: pointer;
  &:hover {
    background: #f2f2f2;
  }
`;

interface RoleDropdownProps {
  value: string;
  onChange: (v: string) => void;
}

export default function RoleDropdown({ value, onChange }: RoleDropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const options = [
    { value: "Farmer", label: "茶行" },
    { value: "Consumer", label: "消費者" },
  ];

  // 點擊外面自動關閉
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <DropdownWrapper ref={wrapperRef}>
      <DropdownButton type="button" onClick={() => setOpen(!open)}>
        {options.find((o) => o.value === value)?.label || "請選擇角色"}
      </DropdownButton>
      {open && (
        <DropdownList>
          {options.map((opt) => (
            <DropdownItem
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </DropdownItem>
          ))}
        </DropdownList>
      )}
    </DropdownWrapper>
  );
}
