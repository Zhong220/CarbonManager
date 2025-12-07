import React from "react";
import styled from "styled-components";
import type { StageStepAgg } from "@/utils/aggregateEmissions";
import { GRID_COLUMNS } from "./StageAccordion";

type Props = {
  data: StageStepAgg;         // 單一階段彙總（含 steps）
  unit?: "kg" | "g";
  maxSteps?: number;          // 預設折疊
};

export default function StageBreakdown({ data, unit = "kg", maxSteps = 6 }: Props) {
  const [expanded, setExpanded] = React.useState(false);
  const steps = expanded ? data.steps : data.steps.slice(0, maxSteps);

  const fmt = (v: number) => (unit === "kg" ? v.toFixed(2) : (v * 1000).toFixed(0));
  const labelUnit = unit === "kg" ? "kg CO₂e" : "g CO₂e";

  return (
    <Wrap aria-label={`階段 ${data.stageName} 的步驟排放明細`}>
      {steps.length === 0 ? (
        <Empty>此階段暫無資料</Empty>
      ) : (
        steps.map((s) => (
          <Row key={s.stepId}>
            <Name title={s.stepName}>{s.stepName}</Name>
            <BarWrap>
              <Bar $w={data.total ? (s.total / data.total) * 100 : 0} />
            </BarWrap>
            <Val>
              {fmt(s.total)} <Unit>{labelUnit}</Unit>
              <Pct>（{(s.pct * 100).toFixed(1)}%）</Pct>
            </Val>
          </Row>
        ))
      )}

      {data.steps.length > maxSteps && (
        <More type="button" onClick={() => setExpanded(!expanded)}>
          {expanded ? "收合" : `顯示全部 ${data.steps.length} 筆`}
        </More>
      )}
    </Wrap>
  );
}

/* styles */
const Wrap = styled.div`display:flex; flex-direction:column; gap:8px;`;

/** 與 Stage Header 使用相同的欄寬，確保軌道對齊 */
const Row = styled.div`
  display: grid;
  grid-template-columns: ${GRID_COLUMNS};
  align-items: center;
  gap: 12px;
  padding: 4px 0;
`;

const Name = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #2c3e2c;
  font-weight: 700;     /* Step 比 Stage 弱一級 */
  font-size: 15px;
`;

const BarWrap = styled.div`
  height: 8px;
  background: #eef4ee;
  border-radius: 999px;
  overflow: hidden;
`;
const Bar = styled.div<{ $w:number }>`
  height: 100%;
  width: ${p=>Math.max(0, Math.min(100, p.$w))}%;
  background: #4caf50;
`;

const Val = styled.div`white-space:nowrap; color:#2c3e2c; font-size: 14px;`;
const Unit = styled.span`opacity:.7; font-size:12px; margin-left:4px;`;
const Pct = styled.span`opacity:.6; margin-left:4px; font-size: 12px;`;
const More = styled.button`
  align-self:flex-start; background:#f6faf6; border:1px solid #e1e9e1;
  border-radius:999px; padding:4px 10px; cursor:pointer; color:#2c3e2c;
`;
const Empty = styled.div`color:#8a8a8a;`;
