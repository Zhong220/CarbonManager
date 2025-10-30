import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import WelcomePage from "@/pages/welcome/WelcomePage";
import ProductListPage from "@/pages/products/ProductListPage";
import ProductLifeCyclePage from "@/pages/lifecycle/ProductLifeCycle";

import { UserProvider, useUser } from "@/context/UserContext";
import { ReportProvider } from "@/context/ReportContext";

/** 首頁判斷：
 *  - 已登入（有 account 且 role !== 'None'）→ 進 /products
 *  - 未登入 → 顯示 WelcomePage
 */
function HomeGate() {
  const { ready, account, role } = useUser();

  if (!ready) return <div style={{ padding: 16 }}>載入中…</div>;

  const isLoggedIn = !!account && role !== "None";
  if (isLoggedIn) return <Navigate to="/products" replace />;
  return <WelcomePage />;
}

/** 受保護路由：未登入就導回首頁 */
function RequireAuth({ children }: { children: React.ReactElement }) {
  const { ready, account, role } = useUser();
  const loc = useLocation();

  if (!ready) return <div style={{ padding: 16 }}>載入中…</div>;

  const isLoggedIn = !!account && role !== "None";
  if (!isLoggedIn) {
    return <Navigate to="/" replace state={{ from: loc.pathname }} />;
  }
  return children;
}

export default function App() {
  return (
    <UserProvider>
      <ReportProvider>
        <Routes>
          {/* 首頁：根據登入狀態切換 WelcomePage 或導向 /products */}
          <Route path="/" element={<HomeGate />} />

          {/* 登入後可見的頁面 */}
          <Route
            path="/products"
            element={
              <RequireAuth>
                <ProductListPage />
              </RequireAuth>
            }
          />
          <Route
            path="/products/:productId/lifecycle"
            element={
              <RequireAuth>
                <ProductLifeCyclePage />
              </RequireAuth>
            }
          />

          {/* 兜底：未知路徑回首頁 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ReportProvider>
    </UserProvider>
  );
}
