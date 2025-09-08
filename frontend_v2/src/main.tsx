// CarbonManager/frontend_v2/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GlobalStyle } from "@/ui/styles/GlobalStyle";
import "@/ui/styles/design-tokens.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* React Router v6.28+ 支援 future flags，先開啟 v7 行為 */}
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <GlobalStyle />
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
