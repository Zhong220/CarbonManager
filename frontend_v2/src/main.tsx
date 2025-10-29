import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GlobalStyle } from "@/ui/styles/GlobalStyle";
import "@/ui/styles/design-tokens.css";
import App from "./App";

import {
  migrateLegacyData,
  listBrowsableShops,
  sweepOrphanDataForShop,
  DEFAULT_SHOP_ID,
  // 新增：一次就把所有啟動時需要的清理/遷移都包起來
  bootStorageHousekeeping,
} from "@/utils/storage";

/** 一次性清理：移除所有 `stage_config:<sid>:`（空 pid）的殘留鍵 */
function purgeEmptyStageConfigs() {
  try {
    const toDel: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      // 捕捉 stage_config:<sid>:<pid>，且 <pid> 允許為空字串
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
  // 0) 啟動總整理：包含「沒有任何帳號時 → 清乾淨登入殘留」的策略
  bootStorageHousekeeping();

  // 1) 舊資料遷移（冪等）
  migrateLegacyData();

  // 2) 清掉歷史殘留的空 pid stage_config 鍵（保險刀）
  purgeEmptyStageConfigs();

  // 3) 掃描現有 shop，把沒有對應商品的 records/stage_config/怪鍵清掉
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* React Router v6.28+ 支援 future flags，先開啟 v7 行為 */}
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <GlobalStyle />
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
