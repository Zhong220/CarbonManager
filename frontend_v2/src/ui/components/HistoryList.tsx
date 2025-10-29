import React, { useMemo, useState } from "react";
import styled from "styled-components";
import { Autocomplete, TextField } from "@mui/material";
import emissionFactors from "@/assets/emissionFactors_with_defaults.json";

// 避免和內建 Record 衝突，這裡用 RecordItem 命名
export type RecordItem = {
  id: string; // 唯一鍵（必填）
  productName?: string; // 可選：顯示商品名
  stage: string;
  step: string; // 其實是 tag（用來分群/過濾係數）
  material?: string; // 係數名稱 / 項目名稱
  amount: number;
  unit: string;
  emission?: number; // 排放量
  timestamp: number; // 秒
  date?: string; // 可選：若給了就優先顯示
};

type Props = {
  records: RecordItem[];
  /** 父層接管更新：會帶 { amount } + 可能帶 { material, unit }（當更換係數時） */
  onEdit?: (id: string, patch: Partial<RecordItem>) => void;
  /** 父層接管刪除 */
  onDelete?: (id: string) => void;
};

// 係數選項型別
type CoeffOpt = {
  name: string;
  unit?: string;
  coefficient?: number | string;
  coe?: number | string;
  applicableSteps?: string[];
};

function uniqByNameUnit(list: CoeffOpt[]) {
  const m = new Map<string, CoeffOpt>();
  for (const o of list) {
    const key = `${o.name}__${o.unit ?? ""}`;
    if (!m.has(key)) m.set(key, o);
  }
  return Array.from(m.values());
}

function optionsForTag(tag: string): CoeffOpt[] {
  const arr = (emissionFactors as any[]).filter(
    (f: any) =>
      Array.isArray(f.applicableSteps) && f.applicableSteps.includes(tag)
  );
  return uniqByNameUnit(arr);
}

export default function HistoryList({ records, onEdit, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingItem = useMemo(
    () => records.find((r) => r.id === editingId) || null,
    [editingId, records]
  );

  // 只能編輯「用量」，同時可「更換係數」
  const [draftAmount, setDraftAmount] = useState<string>("");
  const [draftCoeff, setDraftCoeff] = useState<CoeffOpt | null>(null);

  // 開始編輯：用目前值初始化草稿（包含對應的係數選項）
  const startEdit = (r: RecordItem) => {
    setEditingId(r.id);
    setDraftAmount(r.amount?.toString() ?? "");
    // 找到與目前 material+unit 對應的係數選項
    const opts = optionsForTag(r.step);
    const found =
      opts.find(
        (o) =>
          String(o.name).trim() === String(r.material ?? "").trim() &&
          String(o.unit ?? "").trim() === String(r.unit ?? "").trim()
      ) || null;
    setDraftCoeff(found);
  };

  // 取消編輯
  const cancelEdit = () => {
    setEditingId(null);
    setDraftAmount("");
    setDraftCoeff(null);
  };

  // 儲存：amount 必填；如有更換係數，會一併帶 material+unit
  const saveEdit = () => {
    if (!editingId || !onEdit) return;
    const parsed = parseFloat(draftAmount);
    if (Number.isNaN(parsed) || parsed <= 0) {
      alert("請輸入有效的用量");
      return;
    }

    const patch: Partial<RecordItem> = { amount: parsed };
    if (draftCoeff) {
      patch.material = draftCoeff.name;
      patch.unit = draftCoeff.unit ?? "";
    }
    onEdit(editingId, patch);
    cancelEdit();
  };

  if (!records || records.length === 0) {
    return <Empty>尚無歷史紀錄</Empty>;
  }

  return (
    <List>
      {records.map((r, idx) => {
        const tsMs =
          typeof r.timestamp === "number" && !Number.isNaN(r.timestamp)
            ? r.timestamp * 1000
            : undefined;
        const dateStr = r.date ?? (tsMs ? new Date(tsMs).toLocaleString() : "");

        const isEditing = editingId === r.id;
        const coeffOpts = optionsForTag(r.step);
        const coeffFull = `${r.material ?? ""}${r.unit ? `（${r.unit}）` : ""}`;

        return (
          <Item key={r.id || `rec-${idx}`}>
            {/* 第一行：標題＋係數名chip＋排放量徽章＋操作 */}
            <HeaderRow>
              <Title>{r.productName ?? "產品"}</Title>

              <RightBox>
                {!!r.material && !isEditing && (
                  <CoeffChip title={coeffFull}>{coeffFull}</CoeffChip>
                )}
                {!isEditing && typeof r.emission === "number" && (
                  <Badge>{r.emission.toFixed(2)} kg CO₂e</Badge>
                )}
                {(onEdit || onDelete) && (
                  <Actions>
                    {onEdit && !isEditing && (
                      <ActionBtn onClick={() => startEdit(r)}>編輯</ActionBtn>
                    )}
                    {onDelete && !isEditing && r.id && (
                      <ActionBtn danger onClick={() => onDelete(r.id)}>
                        刪除
                      </ActionBtn>
                    )}
                  </Actions>
                )}
              </RightBox>
            </HeaderRow>

            {/* 第二行：階段 / 步驟 與 用量（或改成編輯表單） */}
            {!isEditing ? (
              <>
                <Details>
                  <span>
                    {r.stage} - {r.step}
                  </span>
                  <Dot>•</Dot>
                  <span>
                    {r.amount} {r.unit}
                  </span>
                </Details>
                {dateStr && <DateText>{dateStr}</DateText>}
              </>
            ) : (
              <>
                <EditRow>
                  <Field>
                    <Label>係數（依此步驟可選）</Label>
                    <Autocomplete
                      size="small"
                      options={coeffOpts}
                      value={draftCoeff}
                      onChange={(e, val) => setDraftCoeff(val)}
                      getOptionLabel={(o) =>
                        o ? `${o.name}${o.unit ? `（${o.unit}）` : ""}` : ""
                      }
                      isOptionEqualToValue={(a, b) =>
                        !!a &&
                        !!b &&
                        a.name === b.name &&
                        (a.unit ?? "") === (b.unit ?? "")
                      }
                      renderInput={(params) => (
                        <TextField {...params} placeholder="選擇係數" />
                      )}
                    />
                  </Field>
                </EditRow>

                <EditRow>
                  <Field>
                    <Label>用量</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={draftAmount}
                      onChange={(e) => setDraftAmount(e.target.value)}
                      placeholder="輸入用量"
                    />
                  </Field>
                  <Field style={{ maxWidth: 160 }}>
                    <Label>單位</Label>
                    <ReadonlyBox>
                      {(draftCoeff?.unit ?? editingItem?.unit) || "-"}
                    </ReadonlyBox>
                  </Field>
                </EditRow>

                <Hint>編輯會以「選定係數 × 用量」重新計算排放量。</Hint>

                <EditActions>
                  <SaveBtn onClick={saveEdit}>儲存</SaveBtn>
                  <CancelBtn onClick={cancelEdit}>取消</CancelBtn>
                </EditActions>
              </>
            )}
          </Item>
        );
      })}
    </List>
  );
}

/* ===== styled components ===== */

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 16px;
`;

const Item = styled.div`
  background: #fff;
  border-radius: 12px;
  padding: 12px 14px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0; /* 允許子元素縮小 */

  @media (max-width: 480px) {
    flex-wrap: wrap;
  }
`;

const RightBox = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 1 auto;
  min-width: 0;         /* 允許內部收縮 */
  max-width: 70%;       /* 右側最多佔 70% 寬，避免溢出 */

  @media (max-width: 480px) {
    width: 100%;
    justify-content: flex-start;
    max-width: 100%;
    margin-top: 6px;
  }
`;

const Title = styled.div`
  font-weight: 700;
  font-size: 15px;
  color: #2c3e2c;
  flex: 1 1 auto;       /* 左側吃剩餘空間 */
  min-width: 0;         /* 避免把右側擠爆 */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/* ↓↓↓ 這裡縮小 chip 字級並統一高度 ↓↓↓ */
const CoeffChip = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  height: 22px;            /* 統一膠囊高度 */
  border-radius: 999px;
  background: #eef4ff;
  color: #2a4ea5;
  font-size: 12px;         /* 小一號字體 */
  line-height: 1;          /* 避免看起來偏高 */

  /* 限制寬度＋省略號，隨螢幕寬度調整 */
  max-width: clamp(120px, 35vw, 260px);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Badge = styled.span`
  font-size: 12px;
  padding: 2px 8px;
  height: 22px;            /* 與 chip 對齊 */
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: #eef7ee;
  color: #2e7d32;
  white-space: nowrap;
  flex-shrink: 0;          /* 不要把徽章擠變形 */
`;

const Actions = styled.div`
  display: flex;
  gap: 6px;
  flex-shrink: 0;          /* 按鈕固定大小 */
`;

const ActionBtn = styled.button<{ danger?: boolean }>`
  border: 1px solid ${(p) => (p.danger ? "#ffb4b4" : "#ccd6cc")};
  background: ${(p) => (p.danger ? "#fff1f1" : "#f7fbf7")};
  color: ${(p) => (p.danger ? "#b42318" : "#2e7d32")};
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
`;

const Details = styled.div`
  margin-top: 4px;
  font-size: 14px;
  color: #444;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const Dot = styled.span`
  opacity: 0.5;
`;

const DateText = styled.div`
  margin-top: 6px;
  font-size: 12px;
  color: #777;
`;

const EditRow = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 10px;
  align-items: flex-end;
  flex-wrap: wrap;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 160px;
`;

const Label = styled.label`
  font-size: 12px;
  color: #666;
`;

const Input = styled.input`
  padding: 8px 10px;
  border: 1px solid #d9e2d9;
  border-radius: 8px;
  font-size: 14px;
  width: 100%;
`;

const ReadonlyBox = styled.div`
  padding: 8px 10px;
  border: 1px dashed #d9e2d9;
  border-radius: 8px;
  font-size: 14px;
  color: #555;
  background: #fafafa;
`;

const Hint = styled.div`
  margin-top: 8px;
  font-size: 12px;
  color: #666;
`;

const EditActions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
`;

const SaveBtn = styled.button`
  background: #4caf50;
  color: #fff;
  padding: 6px 12px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-weight: 600;
`;

const CancelBtn = styled.button`
  background: #eee;
  color: #333;
  padding: 6px 12px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
`;

const Empty = styled.div`
  text-align: center;
  color: #aaa;
  margin: 24px;
`;
