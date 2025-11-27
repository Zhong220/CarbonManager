// src/ui/components/HistoryList.tsx
import React, { useMemo, useState, useEffect } from "react";
import styled from "styled-components";
import { Autocomplete, TextField } from "@mui/material";
import {
  apiListFactorsByTag,
  apiSearchFactors,
  FactorDTO,
} from "@/api/lifecycle";

export type RecordItem = {
  id: string;
  productName?: string;
  stage: string;
  step: string; // tag
  material?: string;
  amount: number;
  unit?: string; // 可能不存在 -> 顯示為 "-"
  emission?: number;
  timestamp: number;
  date?: string;
};

type Props = {
  records: RecordItem[];
  onEdit?: (id: string, patch: Partial<RecordItem>) => void;
  onDelete?: (id: string) => void;
};

export default function HistoryList({ records, onEdit, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingItem = useMemo(
    () => records.find((r) => r.id === editingId) || null,
    [editingId, records]
  );

  const [draftAmount, setDraftAmount] = useState<string>("");
  const [draftCoeff, setDraftCoeff] = useState<FactorDTO | null>(null);
  const [factorOptions, setFactorOptions] = useState<FactorDTO[]>([]);
  const [keyword, setKeyword] = useState("");

  const startEdit = (r: RecordItem) => {
    setEditingId(r.id);
    setDraftAmount(r.amount?.toString() ?? "");
    setDraftCoeff(null);
    setKeyword("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftAmount("");
    setDraftCoeff(null);
    setKeyword("");
    setFactorOptions([]);
  };

  // 依「目前正在編輯的步驟 tag + 關鍵字」載入可選係數
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!editingItem) {
        if (!cancelled) {
          setFactorOptions([]);
          setDraftCoeff(null);
        }
        return;
      }

      try {
        let list: FactorDTO[] = [];
        if (keyword.trim()) {
          // 有輸入關鍵字就用 q 搜
          list = await apiSearchFactors({ q: keyword.trim(), limit: 50 });
        } else {
          // 否則按照 step_tag 抓一批
          list = await apiListFactorsByTag({
            step_tag: editingItem.step,
            limit: 50,
          });
        }

        if (cancelled) return;

        // 以 name+unit 去重
        const uniqMap = new Map<string, FactorDTO>();
        for (const f of list || []) {
          const key = `${f.name}__${f.unit ?? ""}`;
          if (!uniqMap.has(key)) uniqMap.set(key, f);
        }
        const opts = Array.from(uniqMap.values());
        setFactorOptions(opts);

        // 盡量幫你自動選回原本的 material + unit
        if (!draftCoeff && editingItem.material) {
          const found = opts.find(
            (o) =>
              String(o.name).trim() ===
                String(editingItem.material ?? "").trim() &&
              String(o.unit ?? "").trim() ===
                String(editingItem.unit ?? "").trim()
          );
          if (found) setDraftCoeff(found);
        }
      } catch (e) {
        console.warn("[HistoryList] 載入係數失敗", e);
        if (!cancelled) {
          setFactorOptions([]);
        }
      }
    };

    const h = setTimeout(run, 250);
    return () => {
      cancelled = true;
      clearTimeout(h);
    };
  }, [editingItem, keyword, draftCoeff]);

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
        const unitShow = r.unit && r.unit.trim() ? r.unit : "-";
        const coeffFull = `${r.material ?? ""}${
          r.unit ? `（${r.unit}）` : ""
        }`;

        return (
          <Item key={r.id || `rec-${idx}`}>
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
                      <ActionBtn $danger onClick={() => onDelete(r.id)}>
                        刪除
                      </ActionBtn>
                    )}
                  </Actions>
                )}
              </RightBox>
            </HeaderRow>

            {!isEditing ? (
              <>
                <Details>
                  <span>
                    {r.stage} - {r.step}
                  </span>
                  <Dot>•</Dot>
                  <span>
                    {r.amount} {unitShow}
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
                      options={factorOptions}
                      value={draftCoeff}
                      onChange={(_e, val: FactorDTO | null) =>
                        setDraftCoeff(val)
                      }
                      onInputChange={(_e, val) => setKeyword(val ?? "")}
                      getOptionLabel={(o: FactorDTO) =>
                        o ? `${o.name}${o.unit ? `（${o.unit}）` : ""}` : ""
                      }
                      isOptionEqualToValue={(a, b) =>
                        !!a && !!b && a.id === b.id
                      }
                      renderOption={(props, option: FactorDTO) => (
                        <li {...props} key={option.id}>
                          {option.name}{" "}
                          {option.unit ? `（${option.unit}）` : ""}
                        </li>
                      )}
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
                      {draftCoeff?.unit ?? editingItem?.unit ?? "-"}
                    </ReadonlyBox>
                  </Field>
                </EditRow>

                <Hint>編輯會以「係數比例 × 新用量」重新估算排放量。</Hint>

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
  min-width: 0;

  @media (max-width: 480px) {
    flex-wrap: wrap;
  }
`;

const RightBox = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 70%;

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
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CoeffChip = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  height: 22px;
  border-radius: 999px;
  background: #eef4ff;
  color: #2a4ea5;
  font-size: 12px;
  line-height: 1;
  max-width: clamp(120px, 35vw, 260px);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Badge = styled.span`
  font-size: 12px;
  padding: 2px 8px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: #eef7ee;
  color: #2e7d32;
  white-space: nowrap;
  flex-shrink: 0;
`;

const Actions = styled.div`
  display: flex;
  gap: 6px;
  flex-shrink: 0;
`;

// ★ Transient prop: 不會傳到 DOM
const ActionBtn = styled.button<{ $danger?: boolean }>`
  border: 1px solid ${(p) => (p.$danger ? "#ffb4b4" : "#ccd6cc")};
  background: ${(p) => (p.$danger ? "#fff1f1" : "#f7fbf7")};
  color: ${(p) => (p.$danger ? "#b42318" : "#2e7d32")};
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
