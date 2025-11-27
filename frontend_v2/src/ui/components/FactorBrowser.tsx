import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { TextField } from "@mui/material";
import { apiSearchFactors, FactorDTO } from "@/api/lifecycle";

export type FactorPick = {
  category?: string;
  midcategory?: string;
  subcategory?: string;
};

type Props = {
  value?: FactorPick;
  onChange?: (pick: FactorPick) => void;
  /** 直接點選某個係數（最底層 name）時回傳，若不需要可不傳 */
  onPickFactor?: (factor: FactorDTO) => void;
  /** 顯示高度（可選） */
  height?: number;
};

const uniq = (arr: (string | null | undefined)[]) =>
  Array.from(new Set(arr.filter(Boolean) as string[]));

export function FactorBrowser({
  value,
  onChange,
  onPickFactor,
  height = 240,
}: Props) {
  const [cat, setCat] = useState<string>(value?.category ?? "");
  const [mid, setMid] = useState<string>(value?.midcategory ?? "");
  const [sub, setSub] = useState<string>(value?.subcategory ?? "");
  const [q, setQ] = useState<string>("");

  const [listCats, setListCats] = useState<string[]>([]);
  const [listMids, setListMids] = useState<string[]>([]);
  const [listSubs, setListSubs] = useState<string[]>([]);
  const [listFactors, setListFactors] = useState<FactorDTO[]>([]);
  const [loading, setLoading] = useState(false);

  /* ==== 與外部 value 同步（父層清空或指定時會反映到本元件） ==== */
  useEffect(() => {
    const nextCat = value?.category ?? "";
    const nextMid = value?.midcategory ?? "";
    const nextSub = value?.subcategory ?? "";
    setCat(nextCat);
    setMid(nextMid);
    setSub(nextSub);
    // 外部切換分類時，避免殘留搜尋字
    setQ("");
  }, [value?.category, value?.midcategory, value?.subcategory]);

  // 對外同步（只回傳有值的）
  useEffect(() => {
    onChange?.({
      category: cat || undefined,
      midcategory: mid || undefined,
      subcategory: sub || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, mid, sub]);

  // 任何一層變動時，往下層清空，並清空搜尋字
  useEffect(() => {
    setMid((prev) => (cat ? prev : ""));
    setSub((prev) => (mid ? prev : ""));
    if (!cat) setMid("");
    if (!mid) setSub("");
    setQ("");
  }, [cat, mid]);

  // 依當前層級載入資料
  useEffect(() => {
    let stop = false;
    const run = async () => {
      setLoading(true);
      try {
        if (!cat) {
          const rows = await apiSearchFactors({ limit: 1000 });
          if (stop) return;
          setListCats(uniq(rows.map((r) => r.category)));
          setListMids([]);
          setListSubs([]);
          setListFactors([]);
          return;
        }
        if (cat && !mid) {
          const rows = await apiSearchFactors({ category: cat, limit: 1000 });
          if (stop) return;
          setListMids(uniq(rows.map((r) => r.midcategory)));
          setListSubs([]);
          setListFactors([]);
          return;
        }
        if (cat && mid && !sub) {
          const rows = await apiSearchFactors({
            category: cat,
            midcategory: mid,
            limit: 1000,
          });
          if (stop) return;
          setListSubs(uniq(rows.map((r) => r.subcategory)));
          setListFactors([]);
          return;
        }
        // cat + mid + sub → 列出 name（可被搜尋 q 過濾）
        const rows = await apiSearchFactors({
          category: cat,
          midcategory: mid,
          subcategory: sub,
          limit: 1000,
          q: q.trim() || undefined,
        });
        if (stop) return;
        setListFactors(rows);
      } catch (e) {
        if (!stop) {
          setListCats([]);
          setListMids([]);
          setListSubs([]);
          setListFactors([]);
          console.error("FactorBrowser load error", e);
        }
      } finally {
        !stop && setLoading(false);
      }
    };
    const h = setTimeout(run, 180); // 小小 debounce
    return () => {
      stop = true;
      clearTimeout(h);
    };
  }, [cat, mid, sub, q]);

  /* 當只剩 1 筆結果且尚未由使用者點選時，自動帶入 */
  useEffect(() => {
    const filteringByCategory = !!(cat || mid || sub);
    const noManualKeyword = q.trim().length === 0; // 有輸入關鍵字就不要強制帶
    if (
      filteringByCategory &&
      noManualKeyword &&
      listFactors.length === 1 &&
      onPickFactor
    ) {
      onPickFactor(listFactors[0]);
    }
  }, [listFactors, cat, mid, sub, q, onPickFactor]);

  const showCat = !cat;
  const showMid = !!cat && !mid;
  const showSub = !!cat && !!mid && !sub;
  const showNames = !!cat && !!mid && !!sub;

  const header = useMemo(() => {
    if (showCat) return "選擇主類別（category）";
    if (showMid) return `選擇中類（${cat} → midcategory）`;
    if (showSub) return `選擇子類（${cat} → ${mid} → subcategory）`;
    return `選擇係數（${cat} → ${mid} → ${sub} → name）`;
  }, [showCat, showMid, showSub, cat, mid, sub]);

  return (
    <Wrap>
      <Title>{header}</Title>

      {showNames && (
        <TextField
          size="small"
          placeholder="搜尋名稱關鍵字…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ marginBottom: "8px" }}
        />
      )}

      <List $h={height}>
        {loading && <Ghost>載入中…</Ghost>}

        {showCat &&
          listCats.map((c) => (
            <Item key={c} onClick={() => setCat(c)}>
              {c}
            </Item>
          ))}

        {showMid &&
          listMids.map((m) => (
            <Item key={m} onClick={() => setMid(m)}>
              {m}
            </Item>
          ))}

        {showSub &&
          listSubs.map((s) => (
            <Item key={s} onClick={() => setSub(s)}>
              {s}
            </Item>
          ))}

        {showNames &&
          listFactors.map((f) => (
            <Item
              key={f.id}
              onClick={() => onPickFactor?.(f)}
              title={f.name}
            >
              {f.name} {f.unit ? `（${f.unit}）` : ""}
            </Item>
          ))}

        {!loading &&
          ((showCat && listCats.length === 0) ||
            (showMid && listMids.length === 0) ||
            (showSub && listSubs.length === 0) ||
            (showNames && listFactors.length === 0)) && (
            <Ghost>目前沒有資料</Ghost>
          )}
      </List>

      {/* 導覽麵包屑 */}
      <CrumbRow>
        <CrumbButton
          disabled={!cat}
          onClick={() => {
            setCat("");
            setMid("");
            setSub("");
            setQ("");
          }}
        >
          category
        </CrumbButton>
        <Sep>›</Sep>
        <CrumbButton
          disabled={!mid}
          onClick={() => {
            setMid("");
            setSub("");
            setQ("");
          }}
        >
          midcategory
        </CrumbButton>
        <Sep>›</Sep>
        <CrumbButton
          disabled={!sub}
          onClick={() => {
            setSub("");
            setQ("");
          }}
        >
          subcategory
        </CrumbButton>
        <Sep>›</Sep>
        <CrumbButton disabled>name</CrumbButton>
      </CrumbRow>
    </Wrap>
  );
}

/* ========== styled ========== */
const Wrap = styled.div`
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 10px;
  background: var(--card);
  margin: 8px 0 10px;
`;

const Title = styled.div`
  font-size: 13px;
  color: var(--muted);
  margin-bottom: 6px;
`;

const List = styled.div<{ $h: number }>`
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: #fafafa;
  max-height: ${({ $h }) => $h}px;
  overflow: auto;
  padding: 6px;
`;

const Item = styled.button`
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border-radius: 8px;
  border: 0;
  background: #fff;
  cursor: pointer;
  margin-bottom: 6px;
  &:hover {
    background: #f2f7f2;
  }
`;

const Ghost = styled.div`
  color: var(--muted);
  font-size: 13px;
  padding: 6px;
`;

const CrumbRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  color: var(--muted);
`;

const CrumbButton = styled.button<{ disabled?: boolean }>`
  border: 1px solid var(--line);
  background: var(--chip);
  color: ${({ disabled }) => (disabled ? "var(--muted)" : "var(--text)")};
  padding: 4px 8px;
  border-radius: 999px;
  cursor: ${({ disabled }) => (disabled ? "default" : "pointer")};
`;

const Sep = styled.span`
  opacity: 0.5;
`;
