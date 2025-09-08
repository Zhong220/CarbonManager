// src/ui/components/HistoryList.tsx
import React from "react";
import styled from "styled-components";

// 避免和內建 Record 衝突，這裡用 RecordItem 命名
export type RecordItem = {
  id: string;                 // 唯一鍵（必填）
  productName?: string;       // 可選：顯示商品名
  stage: string;
  step: string;
  material?: string;          // 可選：項目名稱
  amount: number;
  unit: string;
  emission?: number;          // 可選：排放量
  timestamp: number;          // 秒（後端/儲存時通常是這個）
  date?: string;              // 可選：若給了就優先顯示
};

type Props = {
  records: RecordItem[];
};

export default function HistoryList({ records }: Props) {
  if (!records || records.length === 0) {
    return <Empty>尚無歷史紀錄</Empty>;
  }

  return (
    <List>
      {records.map((r) => {
        // 轉時間字串：若有 r.date 就用，否則用 timestamp（秒）轉
        const tsMs =
          typeof r.timestamp === "number" && !Number.isNaN(r.timestamp)
            ? r.timestamp * 1000
            : undefined;
        const dateStr =
          r.date ??
          (tsMs ? new Date(tsMs).toLocaleString() : "");

        return (
          <Item key={r.id}>
            {/* 第一行：商品名稱（若有）或 material 名稱 */}
            <HeaderRow>
              <Title>
                {r.productName ?? r.material ?? "未命名項目"}
              </Title>
              {typeof r.emission === "number" && (
                <Badge>{r.emission} kg CO₂e</Badge>
              )}
            </HeaderRow>

            {/* 第二行：階段 / 類別 與 用量 */}
            <Details>
              <span>{r.stage} - {r.step}</span>
              <Dot>•</Dot>
              <span>{r.amount} {r.unit}</span>
            </Details>

            {/* 第三行：日期 */}
            {dateStr && <DateText>{dateStr}</DateText>}
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
  box-shadow: 0 1px 6px rgba(0,0,0,0.08);
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const Title = styled.div`
  font-weight: 700;
  font-size: 15px;
  color: #2c3e2c;
`;

const Badge = styled.span`
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef7ee;
  color: #2e7d32;
  white-space: nowrap;
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

const Empty = styled.div`
  text-align: center;
  color: #aaa;
  margin: 24px;
`;
