// src/api/productTypes.ts
// ====================================================================
// Product Types API bindings
// - List, create, update, delete product types
// - Normalizes varying backend shapes into ProductType
// ====================================================================
import { http } from "./http";

export interface ProductType {
  id: number;
  name: string;
  order_id?: number | null;
  organization_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

// -------------------- Helpers --------------------

function normalize(pt: any): ProductType {
  if (!pt) {
    throw new Error("Empty product type payload");
  }
  return {
    id: Number(pt.id),
    name: String(pt.name ?? pt.type_name ?? ""),
    order_id:
      pt.order_id !== undefined && pt.order_id !== null
        ? Number(pt.order_id)
        : null,
    organization_id:
      pt.organization_id !== undefined && pt.organization_id !== null
        ? Number(pt.organization_id)
        : null,
    created_at: pt.created_at ?? null ?? undefined,
    updated_at: pt.updated_at ?? null ?? undefined,
  };
}

function pickList(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.product_types)) return res.product_types;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

function findByName(list: ProductType[], name: string): ProductType | undefined {
  const lower = name.toLowerCase();
  return list.find((t) => (t.name || "").toLowerCase() === lower);
}

// -------------------- API: List --------------------

/** List all product types for current organization */
export async function apiListProductTypes(): Promise<ProductType[]> {
  const res = await http.get<any>("/api/product_types");
  const raw = pickList(res);
  return raw.map(normalize);
}

/** Get a single product type by id */
export async function apiGetProductType(id: number): Promise<ProductType | null> {
  const res = await http.get<any>(`/api/product_types/${id}`);
  if (!res) return null;
  // 可能包在 {product_type: {...}}
  const raw = res.product_type ?? res;
  return normalize(raw);
}

// -------------------- API: Create / Update / Delete --------------------

/** Create new product type (name required) */
export async function apiCreateProductType(payload: {
  name: string;
}): Promise<ProductType> {
  try {
    const res = await http.post<any>("/api/product_types", payload);
    // 後端目前回的可能是直接 row 或 {product_type: row}
    const raw = res.product_type ?? res;
    return normalize(raw);
  } catch (err: any) {
    // 特別處理 409：代表這個名稱的 type 已存在
    const status = err?.status ?? err?.response?.status;
    if (status === 409) {
      // 再去 list 一次從現有清單找同名的
      const list = await apiListProductTypes();
      const existing = findByName(list, payload.name);
      if (existing) return existing;
    }
    throw err;
  }
}

/** Update product type name/order */
export async function apiUpdateProductType(
  id: number,
  patch: Partial<{ name: string; order_id: number }>
): Promise<ProductType> {
  const res = await http.put<any>(`/api/product_types/${id}`, patch);
  const raw = res.product_type ?? res;
  return normalize(raw);
}

/** Delete product type */
export async function apiDeleteProductType(id: number): Promise<void> {
  await http.delete(`/api/product_types/${id}`);
}

// -------------------- Helper: Get or create default --------------------

/**
 * Ensure a "default-like" product type exists.
 * Strategy:
 *   1) 先 list
 *   2) 有名稱包含 "default" 的就用那個
 *   3) 沒有就嘗試建立 "Default Type"
 *   4) 建立時若撞到 409（已存在），再 list 一次找同名的
 */
export async function apiGetOrCreateDefaultType(): Promise<ProductType> {
  const list = await apiListProductTypes();

  const defaultLike =
    list.find((t) => (t.name || "").toLowerCase().includes("default")) ||
    findByName(list, "Default Type") ||
    list[0];

  if (defaultLike) return defaultLike;

  // 這裡可能兩個地方同時進來呼叫，會發生：
  // - A: list → 沒有 → create ⇒ 201
  // - B: list → 沒有 → create ⇒ 409 (名稱已存在)
  // 所以上面的 apiCreateProductType 已經把 409 當成「去抓現有那一筆」處理好了。
  return apiCreateProductType({ name: "Default Type" });
}

export type { ProductType as ProductTypeDTO };
