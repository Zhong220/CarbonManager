// WelcomePage.styles.ts
import styled from "styled-components";

export const Bg = styled.div`
  /* 直接吃滿整個 viewport，做置中 */
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;

  /* 背景色 */
  background: #e9eee8;

  /* 手機左右預留空間，不會貼滿邊 */
  padding: 16px;
  box-sizing: border-box;
`;

export const Card = styled.section`
  width: 100%;
  max-width: 420px;              /* 大螢幕不要太寬，手機像一張卡片 */
  background: #fdfef9;
  border-radius: 24px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08);
  text-align: center;
  padding: 16px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

export const Hero = styled.img`
  display: block;
  width: 100%;        /* 不要 180%，會整個撐出卡片 */
  height: auto;
  border-radius: 16px;
  margin-bottom: 8px;
  object-fit: cover;
`;

export const Title = styled.h1`
  font-size: clamp(20px, 2.6vw, 28px);
  margin: 0 0 4px;
  color: #203319;
  font-weight: 800;
  letter-spacing: 0.2px;
`;

export const Subtitle = styled.p`
  margin: 0 auto 12px;
  color: #4f5b45;
  line-height: 1.6;
  max-width: 56ch;
  padding: 0 4px;
`;

export const Actions = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  max-width: 320px;
  margin: 0 auto;

  @media (min-width: 640px) {
    grid-template-columns: 1fr 1fr;
  }
`;

export const FooterHint = styled.footer`
  margin-top: 8px;
  font-size: 12px;
  color: #6b7a67;
`;
