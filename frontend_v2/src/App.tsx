// frontend_v2/src/App.tsx
import React from "react";
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";

import WelcomePage from "@/pages/welcome/WelcomePage";
import ProductListPage from "@/pages/products/ProductListPage";
import ProductLifeCyclePage from "@/pages/lifecycle/ProductLifeCycle";

import { UserProvider, useUser } from "@/context/UserContext";
import { ReportProvider } from "@/context/ReportContext";

/** 首頁：未登入顯示 Welcome；已登入只導「一次」到 /products/__all 」*/
function HomeGate() {
  const { ready, isAuthed } = useUser();
  if (!ready) return <div style={{ padding: 16 }}>載入中…</div>;
  if (isAuthed) return <Navigate to="/products/__all" replace />; // ← 改這裡
  return <WelcomePage />;
}

/** 受保護路由：ready 前不判斷；未登入才導回首頁 */
function Guard() {
  const { ready, isAuthed } = useUser();
  const loc = useLocation();
  if (!ready) return null;
  if (!isAuthed) return <Navigate to="/" replace state={{ from: loc.pathname }} />;
  return <Outlet />;
}

export default function App() {
  return (
    <UserProvider>
      <ReportProvider>
        <Routes>
          {/* 首頁：根據登入狀態切換 Welcome 或導向 /products/__all */}
          <Route path="/" element={<HomeGate />} />

          {/* 受保護的功能頁 */}
          <Route element={<Guard />}>
            {/* /products 沒帶 typeId 時，統一導到 /products/__all */}
            <Route path="/products" element={<Navigate to="/products/__all" replace />} /> {/* ← 改這裡 */}
            {/* 產品列表（支援 :typeId=__all 或數字） */}
            <Route path="/products/:typeId" element={<ProductListPage />} />
            {/* 生命週期頁（舊規格：用 productId） */}
            <Route path="/products/:productId/lifecycle" element={<ProductLifeCyclePage />} />
          </Route>

          {/* 兜底：未知路徑回首頁 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ReportProvider>
    </UserProvider>
  );
}
