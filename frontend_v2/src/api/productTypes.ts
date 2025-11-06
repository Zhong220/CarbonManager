// ===============================================================
// src/api/productTypes.ts
// 對齊後端 routes/product_types.py
// - GET /product_types → { product_types: [...] }
// - POST /product_types {name} → 直接回整列 row 物件
// - GET /product_types/:id → { product_type: {...} }
// - PUT /product_types/:id {name} → 200/404
// - DELETE /product_types/:id → 200/404（回傳內容不穩定，前端僅看狀態）
// ===============================================================
import { http } from "./http";

export interface ProductType {
  id: number;
  order_id: number;
  organization_id: number;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export async function apiListProductTypes(): Promise<ProductType[]> {
  const res = await http.get<{ product_types: ProductType[] }>("/api/product_types");
  return Array.isArray(res?.product_types) ? res.product_types : [];
}

export async function apiCreateProductType(payload: { name: string }): Promise<ProductType> {
  // 後端直接回 row（非包在 key 裡）
  const row = await http.post<ProductType>("/api/product_types", payload);
  return row;
}

export async function apiGetProductType(id: number): Promise<ProductType | null> {
  const res = await http.get<{ product_type: ProductType }>("/api/product_types/" + id);
  return res?.product_type ?? null;
}

export async function apiUpdateProductType(id: number, name: string): Promise<boolean> {
  const res = await http.put<{ msg: string }>("/api/product_types/" + id, { name });
  return !!res;
}

export async function apiDeleteProductType(id: number): Promise<boolean> {
  await http.delete("/api/product_types/" + id);
  return true;
}
