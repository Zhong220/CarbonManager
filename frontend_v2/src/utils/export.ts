// src/utils/export.ts
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

/**
 * 匯出 JSON 資料為 Excel
 * @param data 要匯出的資料陣列
 * @param fileName 匯出的檔名
 */
export function exportToExcel(data: any[], fileName: string) {
  // 1. 轉換 JSON → 工作表
  const worksheet = XLSX.utils.json_to_sheet(data);

  // 2. 建立新的活頁簿
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  // 3. 寫出成 ArrayBuffer
  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  // 4. 下載檔案
  const blob = new Blob([excelBuffer], {
    type: "application/octet-stream",
  });
  saveAs(blob, `${fileName}.xlsx`);
}
