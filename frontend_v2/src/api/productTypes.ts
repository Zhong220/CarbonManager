// ====================================================================
// Product Types API bindings
// - List, create, update, delete product types
// - Normalizes varying backend shapes into ProductType
// ====================================================================
import { http } from "./http";

export interface ProductType {
  /** 後端的 id（目前是 display id，例如 PRT1，用字串存） */
  id: string;
  name: string;
  order_id?: number | null;
  organization_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// -------------------- Helpers --------------------

function normalize(pt: any): ProductType {
  if (!pt) {
    throw new Error("Empty product type payload");
  }

  // 後端現在用的是 display id：product_type_id = "PRT1"
  const rawId = pt.product_type_id ?? pt.id ?? pt.display_id;

  // ★ 關鍵修正：把 product_type_name 也納入，最後才 fallback 成「未分類」
  const rawName =
    pt.name ??
    pt.product_type_name ?? // 後端 list_all / add_type / get_pt 回傳的欄位
    pt.type_name ??
    "";

  // organization_id 可能是數字，也可能是 "ORG5"
  let orgId: number | null = null;
  if (pt.organization_id !== undefined && pt.organization_id !== null) {
    if (typeof pt.organization_id === "string") {
      const m = pt.organization_id.match(/\d+$/);
      orgId = m ? Number(m[0]) : null;
    } else {
      orgId = Number(pt.organization_id);
    }
  }

  return {
    id: String(rawId),
    name: rawName === "" ? "未分類" : String(rawName),
    order_id:
      pt.order_id !== undefined && pt.order_id !== null
        ? Number(pt.order_id)
        : null,
    organization_id: orgId,
    created_at: pt.created_at ?? null,
    updated_at: pt.updated_at ?? null,
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

/** Get a single product type by id (display id like "PRT1") */
export async function apiGetProductType(id: string): Promise<ProductType | null> {
  const res = await http.get<any>(`/api/product_types/${id}`);
  if (!res) return null;
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
    const raw = res.product_type ?? res;
    return normalize(raw);
  } catch (err: any) {
    // ★ 保險機制：建立失敗時（包含 409），若已存在同名就直接回那一筆
    try {
      const list = await apiListProductTypes();
      const existing = findByName(list, payload.name);
      if (existing) {
        console.warn(
          "[apiCreateProductType] create failed but found existing, reuse it:",
          existing
        );
        return existing;
      }
    } catch (e) {
      console.warn("[apiCreateProductType] fallback list failed:", e);
    }

    throw err;
  }
}

/** Update product type name/order */
export async function apiUpdateProductType(
  id: string,
  patch: Partial<{ name: string; order_id: number }>
): Promise<ProductType> {
  const res = await http.put<any>(`/api/product_types/${id}`, patch);
  const raw = res.product_type ?? res;
  return normalize(raw);
}

/** Delete product type */
export async function apiDeleteProductType(id: string): Promise<void> {
  await http.delete(`/api/product_types/${id}`);
}

// -------------------- Helper: Get or create default --------------------

/**
 * Ensure a "default-like" product type exists.
 * Strategy:
 *   1) 先 list
 *   2) 有名稱包含 "default" 的就用那個
 *   3) 沒有就嘗試建立「未分類」
 *   4) 建立時若撞到 409 或其它錯誤，就再 list 一次找同名的
 */
export async function apiGetOrCreateDefaultType(): Promise<ProductType> {
  const list = await apiListProductTypes();

  const defaultLike =
    list.find((t) => (t.name || "").toLowerCase().includes("default")) ||
    findByName(list, "未分類") ||
    list[0];

  if (defaultLike) return defaultLike;

  return apiCreateProductType({ name: "未分類" });
}

export type { ProductType as ProductTypeDTO };
