import { createGlobalStyle } from "styled-components";

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; }

  html, body { height: 100%; } /* 根元素 100% 高度 */

  body {
    min-height: 100svh;           /* 實際可視高度，避免 1~2px 溢出 */
    margin: 0;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto;
    color: #222;
    background: #e9eee8;
    overflow-x: clip;              /* 防水平捲動 */
  }

  img, svg, video { max-width: 100%; height: auto; }

  /* 每頁自己的外殼（App 外層不要再包另一個殼） */
  .PageShell {
    /* 用 flex 垂直置中內容，並避免使用外距造成溢出 */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    /* 視口高度（含安全區）；用 box-model 計算內距，不會多 1px */
    min-height: 100svh;

    /* 內距控制上下留白，取代子元素 margin */
    padding-top: calc(var(--header-h) + var(--safe-top) + 16px);
    padding-bottom: calc(24px + var(--safe-bottom));
    padding-left: var(--h-pad);
    padding-right: var(--h-pad);

    /* 寬度限制（桌機不會被卡窄） */
    max-width: var(--shell-max);
    margin: 0 auto;

    /* 讓殼內元素之間的距離靠 gap，而不是 margin */
    gap: 12px;

    /* clip 比 hidden 更平滑，避免陰影被截斷時卡頓 */
    overflow-x: clip;
  }

  /* Modal 在手機也不會超高 */
  .modal-card { max-height: 84dvh; overflow: auto; -webkit-overflow-scrolling: touch; }
`;
