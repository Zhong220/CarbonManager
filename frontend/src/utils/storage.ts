// frontend/src/utils/storage.ts
// Multi-tenant localStorage helper (pure frontend)
// === 編輯 / 刪除「紀錄」的 helper（會自動更新時間） ===
import type { LifeRecord } from "./lifecycleTypes";

export type Role = "Farmer" | "Consumer" | "None";

export interface AccountMeta {
  role: Role;
  password?: string;
  shopIds?: string[];
  currentShopId?: string;
}

export interface TeaShop {
  id: string;
  name: string;
  owner: string;
}

export interface Product {
  id: number;
  name: string;
  categoryId?: string | null;
}

export interface Category {
  id: string;
  name: string;
  order: number; // 用來排序
}

/* Notes */
export interface NoteItem {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  updatedAt: number;
}

// ---------- Keys ----------
const ACCOUNTS_KEY   = "accounts_meta";
const SHOPS_KEY      = "shops_map";
const CURR_ACC_KEY   = "account";
const CURR_ROLE_KEY  = "role";
const CURR_SHOP_KEY  = "currentShopId";

// ---------- Utils ----------
function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key: string, value: any) {
  localStorage.setItem(key, JSON.stringify(value));
}
const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

export const getAccount = () => localStorage.getItem(CURR_ACC_KEY) || "";
export const setAccount = (v: string) => localStorage.setItem(CURR_ACC_KEY, v);
export const clearAccount = () => localStorage.removeItem(CURR_ACC_KEY);

export const getRole = (): Role => (localStorage.getItem(CURR_ROLE_KEY) as Role) || "None";
export const setRole = (v: string) => localStorage.setItem(CURR_ROLE_KEY, v);

export const getCurrentShopId = () => localStorage.getItem(CURR_SHOP_KEY);
export const setCurrentShopId = (id: string) => {
  localStorage.setItem(CURR_SHOP_KEY, id);
  const acc = getAccount();
  if (!acc) return;
  const metas = getAccountsMeta();
  if (metas[acc]) {
    metas[acc].currentShopId = id;
    saveAccountsMeta(metas);
  }
};

// ---------- 帳號 CRUD ----------
export const getAccountsMeta = (): Record<string, AccountMeta> =>
  loadJSON<Record<string, AccountMeta>>(ACCOUNTS_KEY, {});
export const saveAccountsMeta = (obj: Record<string, AccountMeta>) =>
  saveJSON(ACCOUNTS_KEY, obj);

export function accountExists(account: string): boolean {
  const metas = getAccountsMeta();
  return !!metas[account];
}

export function createAccount(account: string, password: string, role: Role = "None") {
  const metas = getAccountsMeta();
  if (metas[account]) throw new Error("帳號已存在");
  metas[account] = { role, password, shopIds: [] };
  saveAccountsMeta(metas);
}

export function verifyLogin(account: string, password: string): boolean {
  const metas = getAccountsMeta();
  const meta = metas[account];
  if (!meta) return false;
  return meta.password === password;
}

export function setRoleOf(account: string, role: Role) {
  const metas = getAccountsMeta();
  if (!metas[account]) return;
  metas[account].role = role;
  saveAccountsMeta(metas);
}

export function deleteAccount(account: string) {
  const metas = getAccountsMeta();
  const meta  = metas[account];
  if (!meta) return;

  (meta.shopIds || []).forEach(id => deleteShop(id));

  delete metas[account];
  saveAccountsMeta(metas);

  if (getAccount() === account) softLogout();
}

// ---------- 茶行 CRUD ----------
export const getShopsMap = (): Record<string, TeaShop> =>
  loadJSON<Record<string, TeaShop>>(SHOPS_KEY, {});
export const saveShopsMap = (obj: Record<string, TeaShop>) =>
  saveJSON(SHOPS_KEY, obj);

export function isShopNameTaken(name: string): boolean {
  const shops = getShopsMap();
  return Object.values(shops).some(s => s.name === name);
}

export function createShop(name: string, owner: string): TeaShop {
  const shops = getShopsMap();
  if (isShopNameTaken(name)) throw new Error("茶行名稱已被使用");

  const id = "shop_" + Date.now();
  shops[id] = { id, name, owner };
  saveShopsMap(shops);

  const metas = getAccountsMeta();
  const meta: AccountMeta = metas[owner] ?? { role: "Farmer" };
  meta.shopIds = uniq([...(meta.shopIds ?? []), id]);
  meta.currentShopId = id;
  metas[owner] = meta;
  saveAccountsMeta(metas);

  setCurrentShopId(id);
  return shops[id];
}

export function deleteShop(shopId: string) {
  const shops = getShopsMap();
  const shop  = shops[shopId];
  if (!shop) return;

  // 刪該 shop 的產品&紀錄
  const prodKey = keyProducts(shopId);
  const products: Product[] = loadJSON<Product[]>(prodKey, []);
  products.forEach(p => {
    localStorage.removeItem(keyRecords(shopId, p.id));
  });
  localStorage.removeItem(prodKey);
  // 刪分類
  localStorage.removeItem(keyCategories(shopId));

  // 從 owner 的 meta 移除
  const metas = getAccountsMeta();
  const ownerMeta = metas[shop.owner];
  if (ownerMeta) {
    ownerMeta.shopIds = (ownerMeta.shopIds || []).filter(id => id !== shopId);
    if (ownerMeta.currentShopId === shopId) {
      ownerMeta.currentShopId = ownerMeta.shopIds?.[0] || undefined;
      if (getAccount() === shop.owner) {
        if (ownerMeta.currentShopId) {
          setCurrentShopId(ownerMeta.currentShopId);
        } else {
          localStorage.removeItem(CURR_SHOP_KEY);
        }
      }
    }
    metas[shop.owner] = ownerMeta;
    saveAccountsMeta(metas);
  }

  delete shops[shopId];
  saveShopsMap(shops);
}

// ---------- 列表 ----------
export function listMyShops(account: string): TeaShop[] {
  const shops = getShopsMap();
  return Object.values(shops).filter(s => s.owner === account);
}
export function listAllShops(): TeaShop[] {
  return Object.values(getShopsMap());
}

// ---------- 產品 / 紀錄 ----------
function keyProducts(shopId: string)   { return `shop_${shopId}_products`; }
function keyRecords(shopId: string, pid: number | string) {
  return `shop_${shopId}_records_${pid}`;
}
function keyCategories(shopId: string) {
  return `shop_${shopId}_categories`;
}

export const loadProducts = (shopId?: string): Product[] => {
  const sid = shopId ?? getCurrentShopId();
  if (!sid) return [];
  return loadJSON<Product[]>(keyProducts(sid), []);
};
export const saveProducts = (list: Product[], shopId?: string) => {
  const sid = shopId ?? getCurrentShopId();
  if (!sid) throw new Error("No shopId to saveProducts");
  saveJSON(keyProducts(sid), list);
};

export const loadRecords = (pid: number | string, shopId?: string) => {
  const sid = shopId ?? getCurrentShopId();
  if (!sid) return [];
  return loadJSON<any[]>(keyRecords(sid, pid), []);
};
export const saveRecords = (pid: number | string, list: any[], shopId?: string) => {
  const sid = shopId ?? getCurrentShopId();
  if (!sid) throw new Error("No shopId to saveRecords");
  saveJSON(keyRecords(sid, pid), list);
};

/** 編輯紀錄：更新部分欄位，並刷新時間戳 */
export function updateRecord(
  productId: string | number,
  shopId: string,
  recordId: string,
  patch: Partial<LifeRecord>
): LifeRecord[] {
  const list = (loadRecords(productId, shopId) as LifeRecord[]) || [];
  const idx = list.findIndex((r) => r.id === recordId);
  if (idx === -1) return list;

  const now = Math.floor(Date.now() / 1000);
  const next = [...list];
  next[idx] = {
    ...next[idx],
    ...patch,
    timestamp: now,
    date: new Date(now * 1000).toISOString(),
  };
  saveRecords(productId, next, shopId);
  return next;
}

/** 刪除紀錄 */
export function deleteRecord(
  productId: string | number,
  shopId: string,
  recordId: string
): LifeRecord[] {
  const list = (loadRecords(productId, shopId) as LifeRecord[]) || [];
  const next = list.filter((r) => r.id !== recordId);
  saveRecords(productId, next, shopId);
  return next;
}

// 新增分類：放到最後
export function addCategory(shopId: string, name: string) {
  const list = loadCategories(shopId);
  const maxOrder = list.length ? Math.max(...list.map(c => c.order)) : -1;
  const newCat: Category = {
    id: "cat_" + Date.now(),
    name,
    order: maxOrder + 1,
  };
  saveCategories(shopId, [...list, newCat]);
  return newCat;
}

// 改名
export function renameCategory(shopId: string, catId: string, newName: string) {
  const list = loadCategories(shopId);
  const idx = list.findIndex(c => c.id === catId);
  if (idx === -1) return;
  list[idx] = { ...list[idx], name: newName };
  saveCategories(shopId, list);
}

// 刪除分類（分類內商品歸零）
export function deleteCategoryAndUnassign(shopId: string, catId: string) {
  const list = loadCategories(shopId).filter(c => c.id !== catId);
  saveCategories(shopId, list);

  // 商品全部取消分類
  const products = loadProducts(shopId).map(p =>
    p.categoryId === catId ? { ...p, categoryId: null } : p
  );
  saveProducts(products, shopId);
}

// 商品設定分類/清除分類
export function setProductCategory(shopId: string, pid: number, catId: string | null) {
  const list = loadProducts(shopId);
  const idx = list.findIndex(p => p.id === pid);
  if (idx === -1) throw new Error("找不到商品");
  list[idx] = { ...list[idx], categoryId: catId };
  saveProducts(list, shopId);
}

// 調整分類順序（用上/下移動）：
export function moveCategory(shopId: string, catId: string, direction: "up" | "down") {
  const list = loadCategories(shopId).sort((a,b)=>a.order-b.order);
  const idx = list.findIndex(c => c.id === catId);
  if (idx === -1) return;

  if (direction === "up" && idx === 0) return;
  if (direction === "down" && idx === list.length - 1) return;

  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  // swap
  const tmp = list[idx];
  list[idx] = list[targetIdx];
  list[targetIdx] = tmp;

  // 重新給 order，保證整數遞增
  const reordered = list.map((c, i) => ({ ...c, order: i }));
  saveCategories(shopId, reordered);
}

// 直接設定整個排序（如果你後面想做拖曳，可用這個）
export function setCategoriesOrder(shopId: string, newOrderIds: string[]) {
  const list = loadCategories(shopId);
  const map = new Map(list.map(c=>[c.id,c]));
  const reordered: Category[] = [];
  newOrderIds.forEach((id, i)=>{
    const c = map.get(id);
    if (c) reordered.push({ ...c, order: i });
    map.delete(id);
  });
  // 剩下沒列到的放最後
  const rest = Array.from(map.values());
  rest.forEach((c, i)=>reordered.push({ ...c, order: reordered.length + i }));
  saveCategories(shopId, reordered);
}

// ---------- Notes ----------
const notesKey = (acc: string) => `notes_${acc}`;

export function loadNotes(acc: string): NoteItem[] {
  if (!acc) return [];
  try {
    return JSON.parse(localStorage.getItem(notesKey(acc)) || "[]");
  } catch {
    return [];
  }
}
export function saveNotes(acc: string, list: NoteItem[]) {
  if (!acc) return;
  localStorage.setItem(notesKey(acc), JSON.stringify(list));
}

// ---------- 登出 ----------
export function softLogout() {
  localStorage.removeItem(CURR_ACC_KEY);
  localStorage.removeItem(CURR_ROLE_KEY);
  localStorage.removeItem(CURR_SHOP_KEY);
}

// ---------- 複製 / 改名 / 刪除 產品 ----------
export function duplicateProduct(shopId: string, srcPid: number, newName: string) {
  if (!shopId) throw new Error("shopId is required to duplicate product.");
  const products = loadProducts(shopId);
  const newId = products.length ? Math.max(...products.map(p => p.id)) + 1 : 1;
  const src = products.find(p=>p.id===srcPid);
  const newProd: Product = {
    id: newId,
    name: newName.trim() || `複製品_${newId}`,
    categoryId: src?.categoryId ?? null,
  };
  saveProducts([...products, newProd], shopId);

  const records = loadRecords(srcPid, shopId) || [];
  saveRecords(newId, records, shopId);

  return newProd;
}

export function renameProduct(shopId: string, pid: number, newName: string) {
  const list = loadProducts(shopId);
  const idx = list.findIndex(p => p.id === pid);
  if (idx === -1) throw new Error("找不到此商品");
  list[idx] = { ...list[idx], name: newName };
  saveProducts(list, shopId);
}

export function deleteProduct(shopId: string, pid: number) {
  const list = loadProducts(shopId).filter(p => p.id !== pid);
  saveProducts(list, shopId);
  localStorage.removeItem(keyRecords(shopId, pid));
}

// ---------- 舊資料搬家 ----------
export function migrateLegacyData() {
  if (localStorage.getItem("__migrated_multi_shop__")) return;

  const oldProductsRaw = localStorage.getItem("products");
  if (oldProductsRaw) {
    let acc = getAccount();
    if (!acc) {
      acc = "legacy_user";
      setAccount(acc);
    }
    if (getRole() === "None") setRole("Farmer");

    const metas = getAccountsMeta();
    if (!metas[acc]) metas[acc] = { role: "Farmer", password: "" };
    saveAccountsMeta(metas);

    const shop = createShop("我的茶行", acc);
    const products: Product[] = JSON.parse(oldProductsRaw);
    saveProducts(products, shop.id);

    products.forEach(p => {
      const recRaw = localStorage.getItem(`records_${p.id}`);
      if (recRaw) {
        saveRecords(p.id, JSON.parse(recRaw), shop.id);
        localStorage.removeItem(`records_${p.id}`);
      }
    });

    localStorage.removeItem("products");
  }

  localStorage.setItem("__migrated_multi_shop__", "1");
}
