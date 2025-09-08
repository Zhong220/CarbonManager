// src/context/ReportContext.tsx
import { createContext, useContext } from "react";
import { exportToExcel } from "@/utils/export";
import { saveAs } from "file-saver";

const Ctx = /*#__PURE__*/ createContext({
  exportXlsmByProduct: (pid: string) => {},
});

export function ReportProvider({ children }: { children: React.ReactNode }) {
  const exportXlsmByProduct = (productId: string) => {
    // 從 localStorage 拿資料
    const data = JSON.parse(localStorage.getItem(`records_${productId}`) || "[]");
    exportToExcel(data, productId); // ✅ 呼叫 utils/export.ts
  };

  return (
    <Ctx.Provider value={{ exportXlsmByProduct }}>
      {children}
    </Ctx.Provider>
  );
}

export const useReport = () => useContext(Ctx);
