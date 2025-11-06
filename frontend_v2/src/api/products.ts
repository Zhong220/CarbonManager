// src/api/products.ts
import { http } from "./http";

/** 前端使用的產品資料形狀（簡化且穩定） */
export interface UIProduct {
  id: number;
  name: string;
  serialNumber?: number | null;
  // 之後要擴充再加
}

/** ----------- 小工具：把各種回傳長相標準化 ----------- */
function normalizeList<T = any>(res: any): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res as T[];
  if (Array.isArray(res.items)) return res.items as T[];
  if (Array.isArray(res.data)) return res.data as T[];
  if (Array.isArray(res.list)) return res.list as T[];
  if (Array.isArray(res.products)) return res.products as T[];
  // map 物件：{ "1": {...}, "2": {...} }
  if (typeof res === "object") {
    const vals = Object.values(res);
    if (vals.length && typeof vals[0] === "object" && "id" in (vals[0] as any)) {
      return vals as T[];
    }
  }
  return [];
}

function normalizeOne<T = any>(res: any): T {
  if (!res) throw new Error("Empty response");
  if (res.id) return res as T;
  if (res.product?.id) return res.product as T;
  if (res.data?.id) return res.data as T;
  return res as T;
}

/** 後端欄位 → UI 欄位 */
function toUIProduct(x: any): UIProduct {
  const src = normalizeOne<any>(x);
  const id = Number(src.id ?? src.product_id ?? src.pid);
  const name =
    String(
      src.name ??
        src.product_name ??
        src.title ??
        src.display_name ??
        ""
    ) || `#${id}`;

  const serial =
    src.serialNumber ??
    src.serial_no ??
    src.serial_no_id ??
    src.serial ??
    null;

  return {
    id: Number.isFinite(id) ? id : 0,
    name,
    serialNumber: serial != null ? Number(serial) : null,
  };
}

/** 陣列 → UI 陣列 */
function toUIList(res: any): UIProduct[] {
  return normalizeList<any>(res).map(toUIProduct);
}

/** =========================================================
 *  REST 對齊後端：/api/product_types/:typeId/products
 * ======================================================= */

/** 依產品類型列出產品 */
export async function apiListProducts(typeId: number): Promise<UIProduct[]> {
  const raw = await http.get<any>(`/api/product_types/${typeId}/products`);
  return toUIList(raw);
}

/** 新增產品（同名衝突由後端決定 409；這裡只拋錯讓 UI 顯示） */
export async function apiCreateProduct(
  typeId: number,
  body: { name: string }
): Promise<UIProduct> {
  const raw = await http.post<any>(`/api/product_types/${typeId}/products`, body);
  return toUIProduct(raw);
}

/** 讀單一產品 */
export async function apiGetProduct(
  typeId: number,
  productId: number
): Promise<UIProduct> {
  const raw = await http.get<any>(`/api/product_types/${typeId}/products/${productId}`);
  return toUIProduct(raw);
}

/** 更新產品 */
export async function apiUpdateProduct(
  typeId: number,
  productId: number,
  body: { name?: string }
): Promise<UIProduct> {
  const raw = await http.put<any>(`/api/product_types/${typeId}/products/${productId}`, body);
  return toUIProduct(raw);
}

/** 刪除產品 */
export async function apiDeleteProduct(
  typeId: number,
  productId: number
): Promise<void> {
  await http.delete(`/api/product_types/${typeId}/products/${productId}`);
}
