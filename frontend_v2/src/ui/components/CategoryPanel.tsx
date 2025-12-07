// src/ui/components/CategoryPanel.tsx
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import Modal from "@/ui/components/Modal";
import {
  loadCategories,
  addCategory,
  renameCategory,
  deleteCategoryAndUnassign,
  moveCategory,
  setProductCategory,
  getCurrentShopIdSafe,
  pushRecentCategoryId,
  Category,
  loadProducts, // 計數
} from "@/utils/storage";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 要指派的商品 id（若不傳，仍可管理分類） */
  productId?: string | number;
  /** 當前商品的分類 id（可為 null） */
  currentCategoryId?: string | null;
  onPicked?: () => void;
};

export default function CategoryPanel({
  open,
  onClose,
  productId,
  currentCategoryId = null,
  onPicked,
}: Props) {
  const sid = getCurrentShopIdSafe();

  const [cats, setCats] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const [activeCatId, setActiveCatId] = useState<string | null>(currentCategoryId);

  /** 版本號：任何資料變動後 bump 以觸發統計刷新 */
  const [v, setV] = useState(0);
  const bump = () => setV((x) => x + 1);

  const refresh = () => {
    setCats(loadCategories(sid).sort((a, b) => a.order - b.order));
  };

  useEffect(() => {
    if (open) {
      refresh();
      setActiveCatId(currentCategoryId ?? null);
      setSearch(""); // 開啟時清空搜尋，避免殘留舊關鍵字
      setEditingId(null);
      setEditingName("");
      // 不改 newName，避免使用者打到一半被清掉
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* 數量統計（依賴 v 保證即時刷新） */
  const counts = useMemo(() => {
    const products = loadProducts?.(sid) ?? [];
    const map = new Map<string, number>();
    let unassigned = 0;
    products.forEach((p: any) => {
      const cid = p?.categoryId ?? null;
      if (!cid) unassigned += 1;
      else map.set(cid, (map.get(cid) || 0) + 1);
    });
    return { total: products.length, unassigned, byId: map };
  }, [sid, cats, v]);

  /* 左：挑選/指派 */
  const handlePick = (catId: string | null) => {
    if (catId === "__ALL__") {
      setActiveCatId("__ALL__");
      return;
    }
    if (productId == null) {
      setActiveCatId(catId);
      return;
    }
    // 指派商品分類（保留你原本的簽名）
    setProductCategory(sid, productId as any, catId);
    setActiveCatId(catId);
    if (catId) pushRecentCategoryId(catId, sid);
    bump();           // 更新統計
    onPicked?.();     // 交由外層決定是否關閉
  };

  /* 右：管理 */
  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    addCategory(sid, name);
    setNewName("");
    refresh();
    bump();
  };

  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setEditingName(c.name);
  };

  const confirmEdit = () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) return;
    renameCategory(sid, editingId, name);
    setEditingId(null);
    setEditingName("");
    refresh();
    bump();
  };

  const handleDelete = (id: string) => {
    if (!confirm("確定刪除此分類？分類內商品會被取消分類。")) return;
    deleteCategoryAndUnassign(sid, id);
    if (activeCatId === id) setActiveCatId(null);
    refresh();
    bump();
  };

  const filteredCats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cats;
    return cats.filter((c) => c.name.toLowerCase().includes(q));
  }, [cats, search]);

  return (
    <Modal open={open} onClose={onClose} ariaLabel="分類面板">
      <Wrap>
        <Header>
          <div className="title">
            <Title>分類面板</Title>
            <Sub>選擇 / 指派　→　管理</Sub>
          </div>
          <CloseBtn aria-label="關閉" onClick={onClose}>✕</CloseBtn>
        </Header>

        {/* 單欄：上（選擇） */}
        <SectionCard>
          <SectionHead>選擇分類</SectionHead>
          <SearchBox
            placeholder="搜尋分類名稱…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="搜尋分類"
          />

          <PickerList role="menu">
            {/* 全部（統計列，不可指派） */}
            <StatRow
              role="button"
              aria-current={activeCatId === "__ALL__" ? "true" : "false"}
              $active={activeCatId === "__ALL__"}
              onClick={() => setActiveCatId("__ALL__")}
              title="全部"
            >
              <StatLeft>
                <StatIcon aria-hidden>📊</StatIcon>
                <ItemLabel>全部</ItemLabel>
              </StatLeft>
              <Badge aria-label={`全部 ${counts.total} 筆`}>{counts.total}</Badge>
            </StatRow>

            {/* 未分類（可指派） */}
            <PickerItem
              role="menuitemradio"
              aria-checked={activeCatId === null}
              $active={activeCatId === null}
              onClick={() => handlePick(null)}
              title="未分類"
            >
              <Left>
                <Radio $active={activeCatId === null} />
                <ItemLabel>未分類</ItemLabel>
              </Left>
              <Badge aria-label={`未分類 ${counts.unassigned} 筆`}>
                {counts.unassigned}
              </Badge>
            </PickerItem>

            {/* 其他分類 */}
            {filteredCats.map((c) => {
              const active = activeCatId === c.id;
              const n = counts.byId.get(c.id) || 0;
              return (
                <PickerItem
                  key={c.id}
                  role="menuitemradio"
                  aria-checked={active}
                  $active={active}
                  onClick={() => handlePick(c.id)}
                  title={c.name}
                >
                  <Left>
                    <Radio $active={active} />
                    <ItemLabel>{c.name}</ItemLabel>
                  </Left>
                  <Badge aria-label={`${c.name} ${n} 筆`}>{n}</Badge>
                </PickerItem>
              );
            })}
          </PickerList>

          {productId != null && (
            <Hint>點清單即可把此商品指派到該分類（不會自動關閉）。</Hint>
          )}
        </SectionCard>

        {/* 單欄：下（管理） */}
        <SectionCard>
          <SectionHead>管理分類</SectionHead>

          <AddRow
            onSubmit={(e) => {
              e.preventDefault();
              handleAdd();
            }}
          >
            <Input
              placeholder="新增分類名稱"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <BtnPrimary type="submit" $small>新增</BtnPrimary>
          </AddRow>

          <List>
            {cats.length === 0 ? (
              <Empty>尚無分類</Empty>
            ) : (
              cats.map((c, idx) => {
                const isEditing = editingId === c.id;
                return (
                  <Row key={c.id}>
                    <Main>
                      {isEditing ? (
                        <InlineEdit
                          onSubmit={(e) => {
                            e.preventDefault();
                            confirmEdit();
                          }}
                        >
                          <Input
                            autoFocus
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && confirmEdit()}
                          />
                          <BtnPrimary type="submit" $small>儲存</BtnPrimary>
                          <BtnSecondary
                            type="button"
                            $small
                            onClick={() => {
                              setEditingId(null);
                              setEditingName("");
                            }}
                          >
                            取消
                          </BtnSecondary>
                        </InlineEdit>
                      ) : (
                        <Name title={c.name}>{c.name}</Name>
                      )}
                    </Main>

                    {!isEditing && (
                      <Actions>
                        <IconBtn
                          aria-label="上移"
                          disabled={idx === 0}
                          onClick={() => {
                            moveCategory(sid, c.id, "up");
                            refresh();
                            bump();
                          }}
                          title="上移"
                        >
                          ↑
                        </IconBtn>
                        <IconBtn
                          aria-label="下移"
                          disabled={idx === cats.length - 1}
                          onClick={() => {
                            moveCategory(sid, c.id, "down");
                            refresh();
                            bump();
                          }}
                          title="下移"
                        >
                          ↓
                        </IconBtn>
                        <BtnSecondary $small onClick={() => startEdit(c)}>改名</BtnSecondary>
                        <BtnDanger $small onClick={() => handleDelete(c.id)}>刪除</BtnDanger>
                      </Actions>
                    )}
                  </Row>
                );
              })
            )}
          </List>
        </SectionCard>

        <Footer>
          <BtnSecondary onClick={onClose}>關閉</BtnSecondary>
        </Footer>
      </Wrap>
    </Modal>
  );
}

/* ============ Styles ============ */

const Wrap = styled.div`
  width: 100%;
  max-width: 760px;
  padding: 12px 12px 8px;
  box-sizing: border-box;
`;

const Header = styled.div`
  margin: 4px 0 10px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;

  .title { min-width: 0; }
`;

const Title = styled.h3`
  margin: 0 0 4px;
`;
const Sub = styled.div`
  color: #6b6b6b;
  font-size: 13px;
`;

const CloseBtn = styled.button`
  border: 1px solid #e1e9e1;
  background: #f7faf7;
  color: #2c3e2c;
  border-radius: 10px;
  padding: 6px 10px;
  cursor: pointer;
`;

const SectionCard = styled.section`
  background: #ffffff;
  border: 1px solid #edf2ed;
  border-radius: 14px;
  padding: 12px;
  margin-bottom: 12px;
  min-width: 0;
`;

const SectionHead = styled.h4`
  margin: 0 0 10px;
  color: #2c3e2c;
`;

const SearchBox = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #cfd8cf;
  border-radius: 12px;
  font-size: 14px;
  margin-bottom: 8px;
  box-sizing: border-box;
`;

const PickerList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const StatRow = styled.li<{ $active?: boolean }>`
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px dashed ${({ $active }) => ($active ? "#b9dfbc" : "#dfe6df")};
  background: ${({ $active }) => ($active ? "rgba(76,175,80,.06)" : "#f9fcf8")};
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;
  cursor: pointer;

  &:hover {
    background: ${({ $active }) => ($active ? "rgba(76,175,80,.10)" : "rgba(0,0,0,.03)")};
  }
`;

const StatLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const StatIcon = styled.span`
  width: 18px;
  text-align: center;
`;

const PickerItem = styled.li<{ $active?: boolean }>`
  padding: 12px;
  cursor: pointer;
  user-select: none;
  border: 1px solid ${({ $active }) => ($active ? "#b9dfbc" : "#e9f0e9")};
  background: ${({ $active }) => ($active ? "rgba(76,175,80,.12)" : "#fafdfb")};
  color: ${({ $active }) => ($active ? "#2e7d32" : "#2c3e2c")};
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  border-radius: 12px;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;

  &:hover {
    background: ${({ $active }) => ($active ? "rgba(76,175,80,.16)" : "rgba(0,0,0,.04)")};
  }
`;

const Left = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const Radio = styled.span<{ $active?: boolean }>`
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid ${({ $active }) => ($active ? "#388E3C" : "#9fb19f")};
  background: ${({ $active }) => ($active ? "#388E3C" : "transparent")};
  flex: 0 0 auto;
`;

const ItemLabel = styled.span`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Badge = styled.span`
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f1f7f1;
  color: #2e7d32;
  border: 1px solid #dfeade;
`;

const Hint = styled.div`
  margin-top: 8px;
  color: #6b6b6b;
  font-size: 12px;
`;

const AddRow = styled.form`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  margin-bottom: 12px;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 10px;
  background: #fff;
  border: 1px solid #edf2ed;
  border-radius: 12px;
  padding: 10px 12px;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
    align-items: start;
  }

  &:hover {
    background: #fbfdfb;
  }
`;

const Main = styled.div`
  min-width: 0;
`;
const Name = styled.div`
  font-weight: 600;
  color: #2c3e2c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const InlineEdit = styled.form`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
    & > button { width: 100%; }
  }
`;

const Actions = styled.div`
  display: inline-flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;

  @media (max-width: 480px) {
    justify-content: flex-start;
  }
`;

const Input = styled.input`
  min-width: 0;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #cfd8cf;
  border-radius: 10px;
  font-size: 14px;
  box-sizing: border-box;
`;

/* 按鈕們（使用暫態屬性，避免傳到 DOM） */
const BaseBtn = styled.button.withConfig({
  shouldForwardProp: (prop) => prop !== 'small' && prop !== '$small',
})<{ $small?: boolean }>`
  border: none;
  border-radius: 10px;
  height: ${({ $small }) => ($small ? "32px" : "40px")};
  padding: 0 ${({ $small }) => ($small ? "10px" : "16px")};
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
`;

const BtnPrimary = styled(BaseBtn)`
  background: #4caf50;
  color: #fff;
  font-weight: 700;
`;

const BtnSecondary = styled(BaseBtn)`
  background: #fff;
  color: #203319;
  border: 1px solid #dfe6da;
`;

const BtnDanger = styled(BaseBtn)`
  background: #fff;
  color: #b00020;
  border: 1px solid #ef9a9a;
`;

const IconBtn = styled.button<{ disabled?: boolean }>`
  width: 28px;
  height: 28px;
  border: 1px solid #e5ece5;
  border-radius: 8px;
  background: #f6faf6;
  color: #333;
  cursor: pointer;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;

  opacity: ${({ disabled }) => (disabled ? 0.5 : 1)};
  pointer-events: ${({ disabled }) => (disabled ? "none" : "auto")};
`;

const Footer = styled.div`
  text-align: right;
  margin-top: 8px;
`;
const Empty = styled.div`
  color: #8a8a8a;
  text-align: center;
  padding: 18px 0;
`;
