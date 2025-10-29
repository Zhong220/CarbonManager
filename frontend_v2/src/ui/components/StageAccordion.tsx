// src/ui/components/StageAccordion.tsx
import React, { useState } from "react";
import styled from "styled-components";
import type { StageAgg } from "@/utils/aggregateEmissions";

type Props = {
  data: StageAgg;
  grandTotal: number;
  defaultOpen?: boolean;
};

export default function StageAccordion({ data, grandTotal, defaultOpen }: Props) {
  const [open, setOpen] = useState(!!defaultOpen);

  const pctAll = grandTotal > 0 ? (data.total / grandTotal) : 0;

  return (
    <Wrap>
      <Header type="button" onClick={() => setOpen(v => !v)}>
        <Left>
          <Title>{data.stageName}</Title>
          <Sub>佔總量 {(pctAll * 100).toFixed(1)}%</Sub>
        </Left>
        <Right>
          <Num>{data.total.toFixed(2)} kg</Num>
          <Caret $open={open}>▾</Caret>
        </Right>
      </Header>

      {open && (
        <Body>
          {data.steps.length === 0 ? (
            <Muted>此階段無資料</Muted>
          ) : (
            <ul>
              {data.steps.map(s => (
                <li key={s.stepId}>
                  <Row>
                    <span>{s.stepName}</span>
                    <strong>{s.total.toFixed(2)} kg</strong>
                  </Row>
                  <Bar>
                    <Fill style={{ width: `${Math.min(100, Math.max(0, Math.round(s.percentOfStage * 100)))}%` }} />
                  </Bar>
                  <SmallMuted>佔本階段 {(s.percentOfStage * 100).toFixed(1)}%</SmallMuted>
                </li>
              ))}
            </ul>
          )}
        </Body>
      )}
    </Wrap>
  );
}

const Wrap = styled.div`
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--card);
`;

const Header = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--card);
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
`;

const Left = styled.div`
  display: grid;
  gap: 2px;
  text-align: left;
`;
const Right = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
`;
const Title = styled.div`
  font-weight: 500;
  color: var(--accent-ink);
`;
const Sub = styled.div`
  font-size: 12px;
  color: var(--muted);
`;
const Num = styled.div`
  font-variant-numeric: tabular-nums;
`;
const Caret = styled.span<{ $open: boolean }>`
  transform: rotate(${p => (p.$open ? 180 : 0)}deg);
  transition: transform .15s ease;
  display: inline-block;
`;

const Body = styled.div`
  padding: 8px 12px 12px;
  border-top: 1px solid var(--line);
  ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; }
  li { margin: 0; }
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 14px;
`;

const Bar = styled.div`
  height: 6px;
  border-radius: 999px;
  background: #eef1ee;
  overflow: hidden;
  margin: 6px 0 2px;
`;
const Fill = styled.div`
  height: 100%;
  background: var(--accent);
`;

const Muted = styled.div`
  color: var(--muted);
  font-size: 14px;
`;
const SmallMuted = styled.div`
  color: var(--muted);
  font-size: 12px;
`;
