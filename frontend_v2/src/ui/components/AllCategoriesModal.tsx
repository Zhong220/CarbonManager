// src/ui/components/AllCategoriesModal.tsx
import React, { useMemo, useState } from "react";
import styled from "styled-components";
import Modal from "@/ui/components/Modal";
import { Category } from "@/utils/storage";

type Props = {
  open: boolean;
  onClose: () => void;
  cats: Category[];                        // 全部分類（已排序）
  counts: Record<string, number>;          // 各分類商品數（由列表頁計算傳入）
  onPick: (catId: string | "__unassigned__" | null) => void; // 選擇分類
};

export default function AllCategoriesModal({ open, onClose, cats, counts, onPick }: Props) {
  const [q, setQ] = useState("");
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return cats;
    return cats.filter(c => c.name.toLowerCase().includes(s));
  }, [cats, q]);

  return (
    <Modal open={open} onClose={onClose} ariaLabel="全部分類">
      <Wrap>
        <Title>全部分類</Title>

        <SearchRow>
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋分類名稱…"
          />
          {q && <Clear onClick={() => setQ("")}>清除</Clear>}
        </SearchRow>

        <List>
          <Item onClick={() => { onPick(null); onClose(); }}>
            <Name>全部</Name>
            <Badge>{Object.values(counts).reduce((a,b)=>a+b, 0)}</Badge>
          </Item>
          <Item onClick={() => { onPick("__unassigned__"); onClose(); }}>
            <Name>未分類</Name>
            <Badge>{counts["__unassigned__"] || 0}</Badge>
          </Item>

          {visible.length === 0 ? (
            <Empty>沒有符合的分類</Empty>
          ) : (
            visible.map(c => (
              <Item key={c.id} onClick={() => { onPick(c.id); onClose(); }}>
                <Name title={c.name}>{c.name}</Name>
                <Badge>{counts[c.id] || 0}</Badge>
              </Item>
            ))
          )}
        </List>

        <Footer>
          <Secondary onClick={onClose}>關閉</Secondary>
        </Footer>
      </Wrap>
    </Modal>
  );
}

/* ---- styled ---- */
const Wrap = styled.div`
  width: 100%;
  max-width: 100%;
  padding: 12px;
  box-sizing: border-box;
`;
const Title = styled.h3` margin: 4px 0 10px; `;
const SearchRow = styled.div`
  display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; margin-bottom: 10px;
`;
const Input = styled.input`
  min-width: 0; padding: 8px 10px; border: 1px solid #cfd8cf; border-radius: 10px; font-size: 14px;
`;
const Clear = styled.button`
  border: 1px solid #e5ece5; background: #f6faf6; border-radius: 10px; padding: 8px 12px; cursor: pointer;
`;
const List = styled.div` display: flex; flex-direction: column; gap: 6px; max-height: 52vh; overflow: auto; `;
const Item = styled.button`
  display: grid; grid-template-columns: 1fr auto; gap: 10px;
  align-items: center; padding: 10px 12px; border-radius: 12px; border: 1px solid #edf2ed;
  background: #fff; cursor: pointer; text-align: left;
  &:hover { background: #f8fbf8; }
`;
const Name = styled.div` white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; color: #2c3e2c; `;
const Badge = styled.span` background: #eef4ee; color: #2e7d32; border-radius: 999px; padding: 2px 8px; font-size: 12px; `;
const Secondary = styled.button` background: #eee; padding: 8px 14px; border-radius: 10px; border: none; cursor: pointer; `;
const Footer = styled.div` text-align: right; margin-top: 8px; `;
const Empty = styled.div` color: #8a8a8a; text-align: center; padding: 16px 0; `;
