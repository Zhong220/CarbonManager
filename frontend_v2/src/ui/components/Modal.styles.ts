// src/ui/components/Modal.styles.ts
import styled from "styled-components";

export const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1300;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);

  /* 讓面板永遠與邊緣保持安全距離，並避免水平滾動 */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;          /* ← 安全邊界 */
  overflow: auto;         /* 小螢幕時可垂直滾動 */
`;

export const Card = styled.div`
  /* 這行是關鍵：在 520px 與 (視窗寬度 - 32px padding) 之間取較小者 */
  width: min(520px, calc(100vw - 32px));
  max-width: 100%;

  /* 高度與滾動處理 */
  max-height: min(80vh, 680px);
  overflow: auto;

  background: #fff;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.25);
  box-sizing: border-box;   /* padding 不再把寬度撐超 */

  /* 版面配置 */
  display: flex;
  flex-direction: column;
  justify-content: flex-start;

  /* 防止子元素的內在尺寸撐破容器造成水平滾動 */
  & * {
    min-width: 0;
  }
`;
