// src/ui/components/CategoryManager.tsx
import React, { useEffect, useState } from "react";
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
  Category,
} from "@/utils/storage";

type Props = { open: boolean; onClose: () => void };

export default function CategoryManager({ open, onClose }: Props) {
  const sid = getCurrentShopIdSafe();
  const [cats, setCats] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const refresh = () =>
    setCats(loadCategories(sid).sort((a, b) => a.order - b.order));

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    addCategory(sid, name);
    setNewName("");
    refresh();
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
  };

  const handleDelete = (id: string) => {
    if (!confirm("確定刪除此分類？分類內商品會被取消分類。")) return;
    deleteCategoryAndUnassign(sid, id);
    refresh();
  };

  return (
    <Modal open={open} onClose={onClose} ariaLabel="分類管理">
      <Wrap>
        <Title>分類管理</Title>

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
          <BtnPrimary type="submit" small>
            新增
          </BtnPrimary>
        </AddRow>

        <List>
          {cats.length === 0 ? (
            <Empty>尚無分類</Empty>
          ) : (
            cats.map((c, idx) => {
              const isEditing = editingId === c.id;
              return (
                <Row key={c.id}>
                  {/* 名稱 / 編輯區 */}
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
                        <BtnPrimary type="submit" small>
                          儲存
                        </BtnPrimary>
                        <BtnSecondary
                          type="button"
                          small
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

                  {/* 右側緊湊功能按鈕群 */}
                  {!isEditing && (
                    <Actions>
                      <IconBtn
                        aria-label="上移"
                        disabled={idx === 0}
                        onClick={() => {
                          moveCategory(sid, c.id, "up");
                          refresh();
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
                        }}
                        title="下移"
                      >
                        ↓
                      </IconBtn>

                      <BtnSecondary small onClick={() => startEdit(c)}>
                        改名
                      </BtnSecondary>
                      <BtnDanger small onClick={() => handleDelete(c.id)}>
                        刪除
                      </BtnDanger>
                    </Actions>
                  )}
                </Row>
              );
            })
          )}
        </List>

        <Footer>
          <BtnSecondary onClick={onClose}>關閉</BtnSecondary>
        </Footer>
      </Wrap>
    </Modal>
  );
}

/* ============ styles ============ */

const Wrap = styled.div`
  width: 100%;
  max-width: 100%;
  padding: 12px 12px 8px;
  box-sizing: border-box;
`;

const Title = styled.h3`
  margin: 4px 0 10px;
`;

const AddRow = styled.form`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  margin-bottom: 10px;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #edf2ed;
  border-radius: 12px;
  padding: 8px 10px;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
    align-items: start;
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
  gap: 6px;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
    & > button {
      width: 100%;
    }
  }
`;

const Actions = styled.div`
  display: inline-flex;
  gap: 6px;
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

const BaseBtn = styled.button<{ small?: boolean }>`
  border: none;
  border-radius: 10px;
  padding: ${({ small }) => (small ? "6px 10px" : "8px 12px")};
  font-size: ${({ small }) => (small ? "13px" : "14px")};
  cursor: pointer;
  white-space: nowrap;
`;

const BtnPrimary = styled(BaseBtn)`
  background: #4caf50;
  color: #fff;
  font-weight: 700;
`;

const BtnSecondary = styled(BaseBtn)`
  background: #eef4ee;
  color: #2c3e2c;
`;

const BtnDanger = styled(BaseBtn)`
  background: #ffecec;
  color: #b00020;
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
