// CarbonManager\frontend_v2\src\main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GlobalStyle } from "@/ui/styles/GlobalStyle";
import "@/ui/styles/design-tokens.css";
import App from "./App";

// Local data / housekeeping（僅清理本機資料，與後端無關）
import {
  migrateLegacyData,
  listBrowsableShops,
  sweepOrphanDataForShop,
  DEFAULT_SHOP_ID,
  bootStorageHousekeeping, // one-shot
} from "@/utils/storage";

// API / Auth
import { http } from "@/api/http";
import { clearTokens } from "@/api/auth";


/** ================== API base 初始化（只做一次） ==================
 * dev：用 Vite proxy ⇒ base = ""（同源 /api/...）
 * prod：讀 .env 的 VITE_API_BASE
 */
if (import.meta.env.MODE === "production" && import.meta.env.VITE_API_BASE) {
  http.setBaseURL(import.meta.env.VITE_API_BASE as string);
} else {
  http.setBaseURL(""); // 開發模式一律留空，交給 Vite 代理
}
console.log("[main] http/auth initialized with base:", http.baseURL);

// ========== 註冊 401 處理（token 失效時自動清理，避免 UI 卡死） ==========
http.setOnUnauthorized(() => {
  try {
    clearTokens();
  } finally {
    // 只做最小副作用：清 token + 友善提醒；是否導回登入交由頁面邏輯
    console.warn("[auth] 401 received → tokens cleared");
  }
});

// ========== （dev）健康檢查，快速確認 proxy/後端是否可達 ==========
if (import.meta.env.MODE !== "production") {
  fetch("/api/health")
    .then((r) => r.text())
    .then((t) => console.info("[dev] /api/health =>", t))
    .catch((e) =>
      console.warn("[dev] /api/health failed (check proxy target/port)", e)
    );
}

// ========== 本機資料清理 ==========
function purgeEmptyStageConfigs() {
  try {
    const toDel: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      const m = k.match(/^stage_config:([^:]*):(.*)$/);
      if (m && m[2].trim() === "") toDel.push(k);
    }
    toDel.forEach((k) => localStorage.removeItem(k));
    if (toDel.length && import.meta.env.MODE !== "production") {
      console.info("[startup] purged empty stage_config keys:", toDel);
    }
  } catch (e) {
    console.warn("[startup] purgeEmptyStageConfigs error:", e);
  }
}

try {
  bootStorageHousekeeping();
  migrateLegacyData();
  purgeEmptyStageConfigs();

  const allShopIds = new Set<string>([
    DEFAULT_SHOP_ID,
    ...listBrowsableShops().map((s) => s.id),
  ]);
  allShopIds.forEach((sid) => sweepOrphanDataForShop(sid));

  if (import.meta.env.MODE !== "production") {
    console.info("[main] startup cleanup done", {
      shops: Array.from(allShopIds),
    });
  }
} catch (e) {
  console.warn("[main] startup migrate/cleanup error:", e);
}

/** --------- Render Root --------- */
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <GlobalStyle />
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// Debug: verify .env injection
console.log("VITE_API_BASE =", import.meta.env.VITE_API_BASE);
