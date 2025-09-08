
import React from "react";
import styled from "styled-components";

export const HEADER_HEIGHT = 44;

export function Header({ title, right }: { title?: string; right?: React.ReactNode }) {
  return (
    <Bar role="banner">
      <Title>{title}</Title>
      {right && <Right>{right}</Right>}
    </Bar>
  );
}

const Bar = styled.header`
  position: fixed;
  top: 0; left: 0; right: 0;
  height: var(--header-h);
  padding-top: var(--safe-top);
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, var(--wood-top), var(--wood-bot));
  color: var(--wood-text);
  z-index: 1200;
  border-bottom: 1px solid rgba(0,0,0,0.05);
`;

const Title = styled.div`
  font-weight: 700;
`;

const Right = styled.div`
  position: absolute; right: 12px; top: calc(50% + var(--safe-top)/2);
  transform: translateY(-50%);
`;
