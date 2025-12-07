// src/ui/components/CategoryButton.tsx
import React, { useState } from "react";
import styled from "styled-components";
import CategoryPanel from "./CategoryPanel";

type Props = {
  productId?: number;
  currentCategoryId?: string | null;
  onPicked?: () => void;
  label?: string; // 預設「分類」
};

export default function CategoryButton({
  productId,
  currentCategoryId = null,
  onPicked,
  label = "分類",
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Btn type="button" onClick={() => setOpen(true)}>{label}</Btn>
      <CategoryPanel
        open={open}
        onClose={() => setOpen(false)}
        productId={productId}
        currentCategoryId={currentCategoryId}
        onPicked={onPicked}
      />
    </>
  );
}

const Btn = styled.button`
  border: 1px solid #dfeade;
  background: #f6faf6;
  color: #2c3e2c;
  border-radius: 10px;
  padding: 8px 12px;
  font-weight: 600;
  cursor: pointer;
`;
