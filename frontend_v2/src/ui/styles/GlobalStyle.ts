import { createGlobalStyle } from "styled-components";

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; }

  :root{
    --bg:        #EEF3EE;   /* 頁面底 */
    --card:      #FFFFFF;   /* 卡片 */
    --line:      #DFE7DA;   /* 邊線 */
    --text:      #1F2D1E;   /* 主要文字 */
    --muted:     #647165;   /* 次要文字 */
    --accent:    #66B468;   /* 主色(綠) */
    --accent-ink:#1E5A2E;   /* 主色深字 */
    --chip:      #F3FAF1;   /* 輕量提示底 */
    --warn:      #B00020;

    --radius-sm: 10px;
    --radius:    14px;
    --radius-lg: 18px;
    --shadow:    0 8px 24px rgba(0,0,0,.12);

    --space-1: 6px;
    --space-2: 10px;
    --space-3: 14px;
    --space-4: 18px;
    --space-5: 24px;

    --shell-max: 1080px;   /* 內容最大寬 */
  }

  html, body { height: 100%; }
  body{
    min-height: 100svh;
    margin: 0;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto;
    color: var(--text);
    background: var(--bg);
    overflow-x: clip;
  }

  img, svg, video { max-width: 100%; height: auto; }
  .modal-card { max-height: 84dvh; overflow: auto; -webkit-overflow-scrolling: touch; }
`;
