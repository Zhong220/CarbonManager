// src/api/productTypes.ts
import { http } from "./http";

export interface ProductType {
  id: number;
  name: string;
  order_id?: number | null;
  organization_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateProductTypeInput {
  name: string;
}

/** 把各種形狀標準化成陣列 */
function normalizeList<T = any>(res: any): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res as T[];
  if (Array.isArray(res.items)) return res.items as T[];
  if (Array.isArray(res.data)) return res.data as T[];
  if (Array.isArray(res.list)) return res.list as T[];
  if (Array.isArray(res.product_types)) return res.product_types as T[];
  if (Array.isArray(res.types)) return res.types as T[];
  if (typeof res === "object") {
    const vals = Object.values(res);
    if (vals.length && typeof vals[0] === "object" && "id" in (vals[0] as any)) {
      return vals as T[];
    }
  }
  return [];
}

/** 取出單筆（處理包裹） */
function normalizeType(res: any): ProductType {
  if (!res) throw new Error("Empty response");
  if (res.id) return res as ProductType;
  if (res.product_type?.id) return res.product_type as ProductType;
  if (res.data?.id) return res.data as ProductType;
  return res as ProductType;
}

/** 依名稱（不分大小寫）在清單中尋找 */
function findByName(list: ProductType[], name: string): ProductType | undefined {
  const target = name.trim().toLowerCase();
  return list.find((t) => (t.name || "").trim().toLowerCase() === target);
}

/** 取清單 */
export async function apiListProductTypes(): Promise<ProductType[]> {
  const raw = await http.get<any>("/api/product_types");
  return normalizeList<ProductType>(raw);
}

/** 新增（409 時回頭用既有那一筆，不丟錯） */
export async function apiCreateProductType(
  body: CreateProductTypeInput
): Promise<ProductType> {
  try {
    const raw = await http.post<any>("/api/product_types", body);
    return normalizeType(raw);
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes("409")) {
      const list = await apiListProductTypes();
      const existed = findByName(list, body.name) || list[0];
      if (existed) return existed;
    }
    throw err;
  }
}

/** 取得或建立 Default Type（不依賴 /default 路由） */
export async function apiGetOrCreateDefaultType(): Promise<ProductType> {
  const list = await apiListProductTypes();
  const defaultLike =
    list.find((t) => (t.name || "").toLowerCase().includes("default")) ||
    findByName(list, "Default Type") ||
    list[0];

  if (defaultLike) return defaultLike;
  return apiCreateProductType({ name: "Default Type" });
}

export type { ProductType as ProductTypeDTO };
