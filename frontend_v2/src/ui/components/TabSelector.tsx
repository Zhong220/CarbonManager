// src/ui/components/TabSelector.tsx
import React from "react";
import styled from "styled-components";

type Props = {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
};

export default function TabSelector({ tabs, active, onChange }: Props) {
  return (
    <Wrapper>
      {tabs.map((tab) => (
        <TabBtn
          key={tab}
          active={active === tab}
          onClick={() => onChange(tab)}
        >
          {tab}
        </TabBtn>
      ))}
    </Wrapper>
  );
}

const Wrapper = styled.div`
  display: flex;
  justify-content: center;
  margin: 12px 0;
  border-bottom: 1px solid #ddd;
`;

const TabBtn = styled.button<{ active: boolean }>`
  flex: 1;
  padding: 12px;
  font-size: 15px;
  font-weight: ${(p) => (p.active ? "bold" : "normal")};
  color: ${(p) => (p.active ? "#5a3e1b" : "#777")};
  background: none;
  border: none;
  cursor: pointer;
  border-bottom: ${(p) =>
    p.active ? "3px solid #5a3e1b" : "3px solid transparent"};
  transition: all 0.2s;

  &:hover {
    color: #5a3e1b;
  }
`;
