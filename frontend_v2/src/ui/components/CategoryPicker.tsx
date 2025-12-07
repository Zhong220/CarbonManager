// src/ui/components/CategoryPicker.tsx
import React, { useMemo } from "react";
import styled from "styled-components";
import {
  getCurrentShopIdSafe,
  loadCategories,
  setProductCategory,
  pushRecentCategoryId,
  Category,
} from "@/utils/storage";

type Props = {
  productId: number;
  currentCategoryId: string | null;
  onPicked?: () => void;
};

export default function CategoryPicker({ productId, currentCategoryId, onPicked }: Props) {
  const shopId = getCurrentShopIdSafe();
  const cats = useMemo(
    () => loadCategories(shopId).sort((a, b) => a.order - b.order),
    [shopId]
  );

  const handlePick = (catId: string | null) => {
    setProductCategory(shopId, productId, catId);
    if (catId) pushRecentCategoryId(catId, shopId);
    onPicked?.();
  };

  return (
    <List role="menu">
      {/* 未分類 */}
      <Item
        role="menuitem"
        $active={currentCategoryId == null}
        onClick={() => handlePick(null)}
      >
        未分類
      </Item>

      {/* 其他分類 */}
      {cats.map((c: Category) => (
        <Item
          key={c.id}
          role="menuitem"
          $active={currentCategoryId === c.id}
          onClick={() => handlePick(c.id)}
        >
          {c.name}
        </Item>
      ))}
    </List>
  );
}

/* ===================== Styles ===================== */

/** 容器 */
const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 6px 0;
`;

/** 單一選項：使用「暫存屬性 $active」避免寫入 DOM */
const Item = styled.li<{ $active?: boolean }>`
  padding: 8px 12px;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;

  background: ${({ $active }) => ($active ? "rgba(76,175,80,.10)" : "transparent")};
  color: ${({ $active }) => ($active ? "#2e7d32" : "#2c3e2c")};
  font-weight: ${({ $active }) => ($active ? 600 : 400)};

  &:hover {
    background: ${({ $active }) => ($active ? "rgba(76,175,80,.15)" : "rgba(0,0,0,.04)")};
  }
`;
