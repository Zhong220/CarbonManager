// ===============================================================
// src/api/products.ts
// 對齊後端 routes/products.py（被掛在 /product_types/<type_id> 底下）
// - GET  /product_types/:typeId/products → { products: [...] }
// - POST /product_types/:typeId/products {name, serial_number?, code?} → 201
// - GET  /product_types/:typeId/products/:id → 直接回 product 物件
// - PUT  /product_types/:typeId/products/:id → 需要帶 name（其餘可沿用舊值）
// - DELETE 同路徑 → 200
// ===============================================================
import { http } from "./http";

export interface BackendProduct {
  id: number;
  organization_id: number;
  type_id: number;
  name: string;
  serial_number: number | null;
  total_emission?: number;
  created_at?: string;
  ended_at?: string | null;
  code?: string | null;
}

export interface UIProduct {
  id: number;
  name: string;
  serialNumber: number | null;
  typeId: number;
  organizationId: number;
  code?: string | null;
}

function toUI(p: BackendProduct): UIProduct {
  return {
    id: p.id,
    name: p.name,
    serialNumber: p.serial_number ?? null,
    typeId: p.type_id,
    organizationId: p.organization_id,
    code: p.code ?? null,
  };
}

export async function apiListProducts(typeId: number): Promise<UIProduct[]> {
  const res = await http.get<{ products: BackendProduct[] }>(
    `/api/product_types/${typeId}/products`
  );
  const list = Array.isArray(res?.products) ? res.products : [];
  return list.map(toUI);
}

export async function apiGetProduct(typeId: number, productId: number): Promise<UIProduct> {
  const p = await http.get<BackendProduct>(`/api/product_types/${typeId}/products/${productId}`);
  return toUI(p);
}

export async function apiCreateProduct(
  typeId: number,
  payload: { name: string; serial_number?: number | null; code?: string | null }
): Promise<void> {
  await http.post(`/api/product_types/${typeId}/products`, payload);
}

export async function apiUpdateProduct(
  typeId: number,
  productId: number,
  patch: { name?: string; serial_number?: number | null; code?: string | null }
): Promise<void> {
  // 後端 update 需要多欄，穩健作法：先抓舊值，再補上 patch
  const current = await apiGetProduct(typeId, productId);
  await http.put(`/api/product_types/${typeId}/products/${productId}`, {
    organization_id: current.organizationId,
    type_id: typeId,
    name: patch.name ?? current.name,
    serial_number: patch.serial_number ?? current.serialNumber,
    code: patch.code ?? current.code ?? null,
  });
}

export async function apiDeleteProduct(typeId: number, productId: number): Promise<void> {
  await http.delete(`/api/product_types/${typeId}/products/${productId}`);
}

/** 取得「所有類型」的商品：會先列出所有類型，再分批抓產品合併 */
export async function apiListAllProducts(typeIds: number[]): Promise<UIProduct[]> {
  const chunks = await Promise.all(typeIds.map((tid) => apiListProducts(tid)));
  return chunks.flat();
}
