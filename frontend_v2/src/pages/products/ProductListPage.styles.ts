// frontend_v2/src/pages/products/ProductListPage.styles.ts
import styled from "styled-components";

export const PageWrapper = styled.div`
  background: #e9eee8; /* 跟歡迎頁一致 */
  min-height: 100vh;

  /* 取消中間那條欄寬，直接吃滿整個畫面 */
  width: 100%;
  margin: 0;

  /* 讓內容跟邊緣保留一點距離（手機／桌機通用） */
  padding: 12px 16px 80px;
  box-sizing: border-box;

  position: relative;
  display: flex;
  flex-direction: column;
`;

export const TopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;

  padding: 12px 16px;
  margin-bottom: 8px;

  background: #fff;
  border-bottom: 1px solid #dfe4db;
  border-radius: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #203319; /* 深綠標題 */
  }

  .actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
`;

export const Hint = styled.div`
  font-size: 14px;
  color: #4f5b45; /* 跟 Subtitle 類似 */
  padding: 4px 4px 8px;
`;

export const List = styled.div`
  padding: 8px 0 16px;
`;

export const ProductCard = styled.div`
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 20px; /* 和歡迎頁 Card 一致 */
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
  padding: 14px 16px;
  margin-bottom: 14px;
  cursor: pointer;
  position: relative;
  transition: transform 0.15s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  }
`;

export const Thumb = styled.div`
  width: 52px;
  height: 52px;
  background: #e9eee8; /* 跟背景呼應 */
  border-radius: 12px;
  margin-right: 14px;
`;

export const ProductInfo = styled.div`
  flex: 1;
`;

export const ProductName = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: #203319; /* 深綠文字 */
`;

export const ProductMeta = styled.div`
  font-size: 13px;
  color: #6b7a67; /* 次要提示色 */
`;

export const MenuWrapper = styled.div`
  font-size: 20px;
  cursor: pointer;
  padding: 0 6px;
  color: #4f5b45;
`;

export const PrimaryBtn = styled.button`
  background: #4caf50;
  border: none;
  color: white;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;

  &:hover {
    background: #45a049;
  }
`;

export const SecondaryBtn = styled.button`
  background: #f3f5f1;
  border-color: #dfe6da;
  color: #2b3a24;
  font-weight: 500;

  &:hover {
    background: #e9eee8;
  }
`;

export const Fab = styled.button`
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #4caf50; /* 改成綠色 */
  color: white;
  font-size: 28px;
  border: none;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
  cursor: pointer;
  z-index: 2000;

  &:hover {
    background: #45a049;
  }
`;

export const ActionBtn = styled(SecondaryBtn)``;
