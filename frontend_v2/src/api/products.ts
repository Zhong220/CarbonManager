// ====================================================================
// Products API bindings
// - REST shape: /api/product_types/:typeId/products
// - Normalizes varying backend shapes into stable UIProduct
// ====================================================================
import { http } from "./http";

// Stable product shape for UI
export interface UIProduct {
  id: number;
  name: string;
  serialNumber?: number | null;
}

// ---- normalizers ----------------------------------------------------

// Normalize list-like responses to an array
function normalizeList<T = any>(res: any): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res as T[];
  if (Array.isArray(res.items)) return res.items as T[];
  if (Array.isArray(res.data)) return res.data as T[];
  if (Array.isArray(res.list)) return res.list as T[];
  if (Array.isArray(res.products)) return res.products as T[];
  // Object map: { "1": {...}, "2": {...} }
  if (typeof res === "object") {
    const vals = Object.values(res);
    if (vals.length && typeof vals[0] === "object" && "id" in (vals[0] as any)) {
      return vals as T[];
    }
  }
  return [];
}

// Normalize single entity (handles wrappers)
function normalizeOne<T = any>(res: any): T {
  if (!res) throw new Error("Empty response");
  if (res.id) return res as T;
  if (res.product?.id) return res.product as T;
  if (res.data?.id) return res.data as T;
  return res as T;
}

// Convert backend fields to UIProduct
function toUIProduct(x: any): UIProduct {
  const src = normalizeOne<any>(x);
  const id = Number(src.id ?? src.product_id ?? src.pid);
  const name =
    String(src.name ?? src.product_name ?? src.title ?? src.display_name ?? "") ||
    `#${id}`;

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

// Convert a list to UIProduct[]
function toUIList(res: any): UIProduct[] {
  return normalizeList<any>(res).map(toUIProduct);
}

// ---- REST bindings --------------------------------------------------

// GET /api/product_types/:typeId/products
export async function apiListProducts(typeId: number): Promise<UIProduct[]> {
  const raw = await http.get<any>(`/api/product_types/${typeId}/products`);
  return toUIList(raw);
}

// POST /api/product_types/:typeId/products
export async function apiCreateProduct(
  typeId: number,
  body: { name: string }
): Promise<UIProduct> {
  const raw = await http.post<any>(`/api/product_types/${typeId}/products`, body);
  return toUIProduct(raw);
}

// GET /api/product_types/:typeId/products/:productId
export async function apiGetProduct(
  typeId: number,
  productId: number
): Promise<UIProduct> {
  const raw = await http.get<any>(`/api/product_types/${typeId}/products/${productId}`);
  return toUIProduct(raw);
}

// PUT /api/product_types/:typeId/products/:productId
export async function apiUpdateProduct(
  typeId: number,
  productId: number,
  body: { name?: string }
): Promise<UIProduct> {
  const raw = await http.put<any>(`/api/product_types/${typeId}/products/${productId}`, body);
  return toUIProduct(raw);
}

// DELETE /api/product_types/:typeId/products/:productId
export async function apiDeleteProduct(
  typeId: number,
  productId: number
): Promise<void> {
  await http.delete(`/api/product_types/${typeId}/products/${productId}`);
}
