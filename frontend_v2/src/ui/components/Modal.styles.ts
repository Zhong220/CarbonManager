import styled from "styled-components";

/* 背景遮罩：用 flex 置中；safe-area 左右取相同值避免視覺偏移 */
export const Backdrop = styled.div`
  --modal-gap: 16px;
  --safe-inline: max(env(safe-area-inset-left), env(safe-area-inset-right), 0px);

  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.42);

  display: flex;
  align-items: center;
  justify-content: center;

  /* 用 padding 保證卡片兩側有留白且不會貼邊 */
  padding-left: calc(var(--modal-gap) + var(--safe-inline));
  padding-right: calc(var(--modal-gap) + var(--safe-inline));
  padding-top: var(--modal-gap);
  padding-bottom: var(--modal-gap);

  box-sizing: border-box;

  @media (max-width: 360px) {
    --modal-gap: 12px;
  }
`;

/* 卡片：寬度以容器內容寬為主，上限由 size 控制；不做任何 vw 撐寬 */
export const Card = styled.div<{ $maxW: number }>`
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.24);
  box-sizing: border-box;

  /* 讓卡片吃滿 Backdrop 的內容寬，但不超過指定上限 */
  width: 100%;
  max-width: ${({ $maxW }) => `${$maxW}px`};
  margin-inline: auto;

  /* 高度限制：由內層 ScrollArea 滾動 */
  max-height: 84dvh;
  overflow: hidden;
`;

/* 內容滾動區：只允許垂直捲動，避免文字/表單撐出水平捲動 */
export const ScrollArea = styled.div`
  padding: 16px;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: calc(84dvh - 2px);
  box-sizing: border-box;
  max-width: 100%;
`;
