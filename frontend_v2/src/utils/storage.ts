// frontend/src/utils/storage.ts
// Multi-tenant localStorage helper (pure frontend)

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

// 預設（安全）Shop Id（當使用者尚未選店家時，資料會寫在這個命名空間下）
export const DEFAULT_SHOP_ID = "__default_shop__";

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

// 取得一個「一定不為空」的 shopId（優先順序：參數 > 現在選擇 > 預設）
function ensureShopId(input?: string): string {
  const sid = input ?? getCurrentShopId() ?? DEFAULT_SHOP_ID;
  return sid;
}
export const getCurrentShopIdSafe = () => ensureShopId();

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

// ========= 最近分類（依 shop 儲存）& 工具 =========
const MAX_RECENT_CATS = 12;
function keyRecentCats(shopId: string) { return `shop_${shopId}_recent_cat_ids`; }

export function getRecentCategoryIds(shopId?: string): string[] {
  const sid = ensureShopId(shopId);
  try {
    return JSON.parse(localStorage.getItem(keyRecentCats(sid)) || "[]");
  } catch {
    return [];
  }
}

export function pushRecentCategoryId(catId: string | null | undefined, shopId?: string) {
  const sid = ensureShopId(shopId);
  if (!catId) return; // 不記錄「全部/未分類」
  const cur = getRecentCategoryIds(sid);
  const next = [catId, ...cur.filter(id => id !== catId)].slice(0, MAX_RECENT_CATS);
  localStorage.setItem(keyRecentCats(sid), JSON.stringify(next));
}

/** 徹底清空一個 shop 的所有資料（產品、紀錄、分類、最近分類） */
function clearShopAllData(shopId: string) {
  const prodKey = keyProducts(shopId);
  const products: Product[] = loadJSON<Product[]>(prodKey, []);
  // 刪每個產品的紀錄
  products.forEach(p => {
    localStorage.removeItem(keyRecords(shopId, p.id));
  });
  // 刪產品清單 / 分類 / 最近分類
  localStorage.removeItem(prodKey);
  localStorage.removeItem(keyCategories(shopId));
  localStorage.removeItem(keyRecentCats(shopId));
}

export function deleteAccount(account: string) {
  const metas = getAccountsMeta();
  const meta  = metas[account];
  if (!meta) return;

  // 刪除此帳號名下所有商店（含其內全部資料）
  (meta.shopIds || []).forEach(id => deleteShop(id));

  // 刪記事
  localStorage.removeItem(notesKey(account));

  // 若此帳號曾在「預設空間」留下資料，一併清掉
  clearShopAllData(DEFAULT_SHOP_ID);

  // 從帳號清單移除
  delete metas[account];
  saveAccountsMeta(metas);

  // 若當前登入就是這個帳號，清掉登入狀態
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

  // 先清掉此 shop 的所有資料
  clearShopAllData(shopId);

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

  // 從 shops_map 刪掉
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
  const sid = ensureShopId(shopId);
  return loadJSON<Product[]>(keyProducts(sid), []);
};
export const saveProducts = (list: Product[], shopId?: string) => {
  const sid = ensureShopId(shopId);
  saveJSON(keyProducts(sid), list);
};

export const loadRecords = (pid: number | string, shopId?: string) => {
  const sid = ensureShopId(shopId);
  return loadJSON<any[]>(keyRecords(sid, pid), []);
};
export const saveRecords = (pid: number | string, list: any[], shopId?: string) => {
  const sid = ensureShopId(shopId);
  saveJSON(keyRecords(sid, pid), list);
};

// ---------- 分類相關 ----------
function normalizeName(s: string) {
  return (s ?? "").trim().toLowerCase();
}
function categoryNameTaken(list: Category[], name: string, excludeId?: string) {
  const norm = normalizeName(name);
  return list.some(c => normalizeName(c.name) === norm && c.id !== excludeId);
}

// 載入/儲存分類
export function loadCategories(shopId: string): Category[] {
  const sid = ensureShopId(shopId);
  return loadJSON<Category[]>(keyCategories(sid), []);
}
export function saveCategories(shopId: string, list: Category[]) {
  const sid = ensureShopId(shopId);
  saveJSON(keyCategories(sid), list);
}

// 提供 UI 檢查：是否重名（忽略大小寫與前後空白）
export function isCategoryNameTaken(shopId: string, name: string, excludeId?: string) {
  const sid = ensureShopId(shopId);
  const list = loadCategories(sid);
  return categoryNameTaken(list, name, excludeId);
}

// 新增分類：放到最後（不可重複）
export function addCategory(shopId: string, name: string) {
  const sid = ensureShopId(shopId);
  const list = loadCategories(sid);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("名稱不可為空");
  if (categoryNameTaken(list, trimmed)) throw new Error("分類名稱已存在");

  const maxOrder = list.length ? Math.max(...list.map(c => c.order)) : -1;
  const newCat: Category = {
    id: "cat_" + Date.now(),
    name: trimmed,
    order: maxOrder + 1,
  };
  saveCategories(sid, [...list, newCat]);
  return newCat;
}

// 改名（不可重複）
export function renameCategory(shopId: string, catId: string, newName: string) {
  const sid = ensureShopId(shopId);
  const list = loadCategories(sid);
  const idx = list.findIndex(c => c.id === catId);
  if (idx === -1) return;

  const trimmed = newName.trim();
  if (!trimmed) throw new Error("名稱不可為空");
  if (categoryNameTaken(list, trimmed, catId)) throw new Error("分類名稱已存在");

  list[idx] = { ...list[idx], name: trimmed };
  saveCategories(sid, list);
}

// 刪除分類（分類內商品歸零）
export function deleteCategoryAndUnassign(shopId: string, catId: string) {
  const sid = ensureShopId(shopId);
  const list = loadCategories(sid).filter(c => c.id !== catId);
  saveCategories(sid, list);

  // 商品全部取消分類
  const products = loadProducts(sid).map(p =>
    p.categoryId === catId ? { ...p, categoryId: null } : p
  );
  saveProducts(products, sid);
}

// 商品設定分類/清除分類
export function setProductCategory(shopId: string, pid: number, catId: string | null) {
  const sid = ensureShopId(shopId);
  const list = loadProducts(sid);
  const idx = list.findIndex(p => p.id === pid);
  if (idx === -1) throw new Error("找不到商品");
  list[idx] = { ...list[idx], categoryId: catId };
  saveProducts(list, sid);
}

// 調整分類順序（用上/下移動）：
export function moveCategory(shopId: string, catId: string, direction: "up" | "down") {
  const sid = ensureShopId(shopId);
  const list = loadCategories(sid).sort((a,b)=>a.order-b.order);
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
  saveCategories(sid, reordered);
}

// 直接設定整個排序（如果你後面想做拖曳，可用這個）
export function setCategoriesOrder(shopId: string, newOrderIds: string[]) {
  const sid = ensureShopId(shopId);
  const list = loadCategories(sid);
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
  saveCategories(sid, reordered);
}

// 🔎 供商品列表做分類搜尋/自動完成
export function searchCategories(shopId: string, query: string): Category[] {
  const sid = ensureShopId(shopId);
  const q = (query ?? "").trim().toLowerCase();
  const list = loadCategories(sid).sort((a,b)=>a.order-b.order);
  if (!q) return list;
  return list.filter(c => c.name.toLowerCase().includes(q));
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
export function duplicateProduct(shopId: string, srcPid: number, newName?: string) {
  const sid = ensureShopId(shopId);
  const products = loadProducts(sid);

  // 產生新商品 id（穩健取最大值）
  const maxId = products.reduce((m, p) => {
    const n = parseInt(String(p.id), 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  const newId = maxId + 1;

  const src = products.find(p => p.id === srcPid);
  if (!src) throw new Error("找不到來源商品");

  const newProd: Product = {
    id: newId,
    name: (newName?.trim() || `${src.name} (複製)`),
    categoryId: src?.categoryId ?? null,
  };
  saveProducts([...products, newProd], sid);

  // === 連同紀錄一起複製，並把時間改為現在 ===
  const nowMs  = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const srcRecords = loadRecords(srcPid, sid) || [];

  const clonedRecords = srcRecords.map((r: any, i: number) => ({
    ...r,
    id: `${nowMs}-${i}`,          // 新的紀錄 id（避免與舊的衝突）
    productId: String(newId),     // 指向新商品
    timestamp: nowSec,            // 改為複製當下
    date: new Date(nowMs).toISOString(),
  }));

  saveRecords(newId, clonedRecords, sid);

  return newProd;
}

export function renameProduct(shopId: string, pid: number, newName: string) {
  const sid = ensureShopId(shopId);
  const list = loadProducts(sid);
  const idx = list.findIndex(p => p.id === pid);
  if (idx === -1) throw new Error("找不到此商品");
  list[idx] = { ...list[idx], name: newName };
  saveProducts(list, sid);
}

export function deleteProduct(shopId: string, pid: number) {
  const sid = ensureShopId(shopId);
  const list = loadProducts(sid).filter(p => p.id !== pid);
  saveProducts(list, sid);
  localStorage.removeItem(keyRecords(sid, pid));
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

// ---- 可瀏覽茶行（給 Consumer 下拉選單用）----
// 來源：shops_map + 由 localStorage 推斷出「有資料的 shop_* 命名空間」+ 預設茶行(若有資料)
export function listBrowsableShops(): TeaShop[] {
  const map = getShopsMap();                     // 已註冊
  const registered = Object.values(map);

  // 判斷某個 shop 是否真的有資料
  const hasDataForShop = (sid: string) => {
    const prods = loadJSON<Product[]>(keyProducts(sid), []);
    const cats  = loadJSON<Category[]>(keyCategories(sid), []);
    const anyRecord = Object.keys(localStorage).some(k =>
      k.startsWith(`shop_${sid}_records_`)
    );
    return prods.length > 0 || cats.length > 0 || anyRecord;
  };

  // 從 localStorage 掃描出所有有資料的 shop_* 命名空間（即使沒在 shops_map 內也補上）
  const inferred: TeaShop[] = [];
  for (const k of Object.keys(localStorage)) {
    // 看到 products / categories 任一個都視為此 shop 存在
    const m1 = k.match(/^shop_(.+?)_products$/);
    const m2 = k.match(/^shop_(.+?)_categories$/);
    const sid = (m1?.[1] ?? m2?.[1]) || null;
    if (!sid) continue;
    if (map[sid]) continue;              // 已在 shops_map
    if (!hasDataForShop(sid)) continue;  // 沒真正資料就跳過
    inferred.push({ id: sid, name: `未知茶行（${sid}）`, owner: "(unknown)" });
  }

  // 預設空間有資料 → 加上「預設茶行」
  const extras: TeaShop[] =
    hasDataForShop(DEFAULT_SHOP_ID) && !map[DEFAULT_SHOP_ID]
      ? [{ id: DEFAULT_SHOP_ID, name: "預設茶行", owner: "(system)" }]
      : [];

  // 合併去重
  const all: Record<string, TeaShop> = {};
  [...registered, ...inferred, ...extras].forEach(s => { all[s.id] = s; });

  // 排序：把「預設茶行」放最前，其餘依名稱排序
  const list = Object.values(all).sort((a, b) => {
    if (a.id === DEFAULT_SHOP_ID) return -1;
    if (b.id === DEFAULT_SHOP_ID) return 1;
    return a.name.localeCompare(b.name);
  });

  return list;
}

// === 追加：生命週期設定存取（修正版：防空、壞資料回復模板並寫回） ===
import { FIXED_STAGE_TEMPLATES, StageConfig, LifeRecord } from "./lifecycleTypes";

// 用 ensureShopId 產生「一定不為空」的 shopId 關鍵字
const STAGE_CONFIG_KEY = (shopId: string, productId: string) =>
  `stage_config:${shopId}:${productId}`;

/** 深拷貝模板，避免外部誤改 */
function cloneTemplate(): StageConfig[] {
  return JSON.parse(JSON.stringify(FIXED_STAGE_TEMPLATES));
}

/** 讀取階段設定：
 *  - 沒資料/壞資料/空陣列 -> 自動回復模板並寫回
 *  - 一律使用 ensureShopId()，不會出現 undefined 命名空間
 */
export function loadStageConfig(shopId?: string, productId?: string): StageConfig[] {
  const sid = ensureShopId(shopId);
  const pid = String(productId ?? "");
  const key = STAGE_CONFIG_KEY(sid, pid);

  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      const tpl = cloneTemplate();
      localStorage.setItem(key, JSON.stringify(tpl));
      return tpl;
    }
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      const tpl = cloneTemplate();
      localStorage.setItem(key, JSON.stringify(tpl));
      return tpl;
    }
    return parsed as StageConfig[];
  } catch {
    const tpl = cloneTemplate();
    localStorage.setItem(key, JSON.stringify(tpl));
    return tpl;
  }
}

/** 寫入階段設定：使用 ensureShopId，確保都落在正確命名空間 */
export function saveStageConfig(shopId?: string, productId?: string, cfg?: StageConfig[]) {
  const sid = ensureShopId(shopId);
  const pid = String(productId ?? "");
  const key = STAGE_CONFIG_KEY(sid, pid);
  const data = Array.isArray(cfg) && cfg.length > 0 ? cfg : cloneTemplate();
  localStorage.setItem(key, JSON.stringify(data));
}

/** 需要時可手動重置某商品的階段設定為模板 */
export function resetStageConfig(shopId?: string, productId?: string): StageConfig[] {
  const sid = ensureShopId(shopId);
  const pid = String(productId ?? "");
  const key = STAGE_CONFIG_KEY(sid, pid);
  const tpl = cloneTemplate();
  localStorage.setItem(key, JSON.stringify(tpl));
  return tpl;
}
