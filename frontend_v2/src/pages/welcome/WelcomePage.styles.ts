import styled from "styled-components";

export const Bg = styled.div`
  /* 吃滿父層（body=100svh），不額外撐高 */
  min-height: 100%;
  background: #e9eee8;
`;

export const Card = styled.section`
  /* 跟著中型容器走，桌機不會超寬、手機不會擠爆 */
  width: min(100%, var(--container-md));
  /* 重要：不要再用上下 margin，避免多 1~2px 造成捲軸 */
  margin: 0 auto;
  padding: clamp(12px, 2.2vw, 24px);
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
  text-align: center;
`;

export const Hero = styled.img`
  display: block;
  width: 180%;
  height: auto;          /* 保比例 */
  aspect-ratio: 4 / 3;   /* 要固定視窗比例可加 */
  object-fit: contain;     /* 要鋪滿卡片就用 cover；不想裁切用 contain */
  image-rendering: auto; /* 如果你有設過 pixelated/crisp-edges，請改回 auto */
`;


export const Title = styled.h1`
  font-size: clamp(20px, 2.6vw, 36px);
  margin: 0 0 6px;
  color: #203319;
  font-weight: 800;
  letter-spacing: 0.2px;
`;

export const Subtitle = styled.p`
  margin: 0 auto clamp(12px, 2vw, 20px);
  color: #4f5b45;
  line-height: 1.6;
  max-width: 56ch;
  padding: 0 clamp(4px, 1vw, 8px);
`;

export const Actions = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  max-width: min(420px, 90vw);
  margin: 0 auto;
  @media (min-width: 640px) {
    grid-template-columns: 1fr 1fr;
  }
`;

export const FooterHint = styled.footer`
  /* 取消 margin，改用內距以避免外距折疊/撐高 */
  padding-top: 8px;
  color: #6b7a67;
  text-align: center;
  width: 100%;
`;

export const Select = styled.select`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
  color: #333;
  appearance: none;   /* 移除原生箭頭 */
  -webkit-appearance: none;
  -moz-appearance: none;

  /* 自訂箭頭 */
  background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg width='14' height='14' viewBox='0 0 20 20' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5 7L10 12L15 7' stroke='%23666' stroke-width='2'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 14px;

  &:focus {
    outline: none;
    border-color: #4caf50;
    box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
  }
`;