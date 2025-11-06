// frontend_v2/src/App.tsx
import React from "react";
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";

import WelcomePage from "@/pages/welcome/WelcomePage";
import ProductListPage from "@/pages/products/ProductListPage";
import ProductLifeCyclePage from "@/pages/lifecycle/ProductLifeCycle";

import { UserProvider, useUser } from "@/context/UserContext";
import { ReportProvider } from "@/context/ReportContext";

/** 首頁：未登入顯示 Welcome；已登入只導「一次」到 /products/1 */
function HomeGate() {
  const { ready, isAuthed } = useUser();
  if (!ready) return <div style={{ padding: 16 }}>載入中…</div>;
  if (isAuthed) return <Navigate to="/products/1" replace />;
  return <WelcomePage />;
}

/** 受保護路由：ready 前不判斷；未登入才導回首頁 */
function Guard() {
  const { ready, isAuthed } = useUser();
  const loc = useLocation();
  if (!ready) return null; // 渲染空白避免在初始化期間觸發導頁循環
  if (!isAuthed) return <Navigate to="/" replace state={{ from: loc.pathname }} />;
  return <Outlet />;
}

export default function App() {
  return (
    <UserProvider>
      <ReportProvider>
        <Routes>
          {/* 首頁：根據登入狀態切換 Welcome 或導向 /products/1 */}
          <Route path="/" element={<HomeGate />} />

          {/* 受保護的功能頁 */}
          <Route element={<Guard />}>
            {/* /products 沒帶 typeId 時，統一導到 /products/1 */}
            <Route path="/products" element={<Navigate to="/products/1" replace />} />
            {/* 產品列表（需要 typeId） */}
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
