// CarbonManager/frontend_v2/src/App.tsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import WelcomePage from "@/pages/welcome/WelcomePage";
import ProductListPage from "@/pages/products/ProductListPage";
import ProductLifeCyclePage from "@/pages/lifecycle/ProductLifeCycle";

// 引入 Context
import { UserProvider } from "@/context/UserContext";
import { ReportProvider } from "@/context/ReportContext";

export default function App() {
  return (
    <UserProvider>
      <ReportProvider>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/products" element={<ProductListPage />} />
          <Route
            path="/products/:productId/lifecycle"
            element={<ProductLifeCyclePage />}
          />
        </Routes>
      </ReportProvider>
    </UserProvider>
  );
}
