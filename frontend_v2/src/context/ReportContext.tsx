// src/context/ReportContext.tsx
import React, { createContext, useContext } from "react";

const Ctx = /*#__PURE__*/ createContext({
  exportXlsmByProduct: async (productId: string) => {},
});

export function ReportProvider({ children }: { children: React.ReactNode }) {
  const exportXlsmByProduct = async (productId: string) => {
    if (!productId) {
      throw new Error("缺少產品 ID");
    }

    // 和 http.ts 一樣的概念：有 VITE_API_BASE 就用，沒有就走 /api
    const base =
      (import.meta.env.VITE_API_BASE as string | undefined) || "/api";

    const url =
      base.replace(/\/$/, "") +
      "/report/" +
      encodeURIComponent(productId); // 例如 PRD1, PRD6

    // 交給瀏覽器下載檔案
    const a = document.createElement("a");
    a.href = url;
    a.download = `${productId}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Ctx.Provider value={{ exportXlsmByProduct }}>
      {children}
    </Ctx.Provider>
  );
}

export const useReport = () => useContext(Ctx);
