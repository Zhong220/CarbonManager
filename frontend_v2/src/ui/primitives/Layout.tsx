// src/ui/primitives/Layout.tsx
import styled from "styled-components";

/** 頁面中段內容的容器（例如卡片區、列表區） */
export const Container = styled.div<{ max?: "sm" | "md" | "lg" }>`
  /* 依需求選擇內容最大寬度，不影響 PageShell */
  --_max: ${({ max }) =>
    max === "sm" ? "var(--container-sm)" :
    max === "md" ? "var(--container-md)" :
    "var(--container-lg)"};
  width: min(var(--_max), 100%);
  margin-left: auto;
  margin-right: auto;
`;

/** 垂直堆疊的工具（可選） */
export const Stack = styled.div<{ gap?: number }>`
  display: grid;
  gap: ${({ gap = 12 }) => `${gap}px`};
`;
