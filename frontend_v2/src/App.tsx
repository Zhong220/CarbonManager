import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import WelcomePage from "@/pages/welcome/WelcomePage";
import ProductListPage from "@/pages/products/ProductListPage";
import ProductLifeCyclePage from "@/pages/lifecycle/ProductLifeCycle";

// 引入 Context
import { UserProvider, useUser } from "@/context/UserContext";
import { ReportProvider } from "@/context/ReportContext";

/** 受保護路由：未登入（role === "None"）就導回首頁 */
function RequireAuth({ children }: { children: React.ReactElement }) {
  const { ready, role } = useUser();

  // 還在判斷登入狀態時，先給個簡單占位（也可換成全螢幕 Spinner）
  if (!ready) return <div style={{ padding: 16 }}>載入中…</div>;

  if (role === "None") {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <UserProvider>
      <ReportProvider>
        <Routes>
          {/* 登入 / 註冊 / 首頁 */}
          <Route path="/" element={<WelcomePage />} />

          {/* 之下皆為需登入頁 */}
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
        </Routes>
      </ReportProvider>
    </UserProvider>
  );
}
