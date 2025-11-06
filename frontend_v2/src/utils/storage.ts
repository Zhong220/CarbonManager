// src/utils/storage.ts
// ===============================================================
// Types & Imports
// ===============================================================
import { openDB, IDBPDatabase } from "idb";
import { FIXED_STAGE_TEMPLATES, StageConfig, LifeRecord } from "./lifecycleTypes";

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

// String, non-recyclable primary key + UI-friendly serialNo
export interface Product {
  id: string;         // e.g. "prod_3q9f..."
  name: string;
  serialNo?: number;  // friendly increasing number for UI
  categoryId?: string | null;
}

export interface Category {
  id: string;
  name: string;
  order: number; // for sorting
}

export interface NoteItem {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  updatedAt: number;
}

// ===============================================================
// Constants / Keys
// ===============================================================
const ACCOUNTS_KEY = "accounts_meta";
const SHOPS_KEY    = "shops_map";
const CURR_ACC_KEY = "account";
const CURR_ROLE_KEY= "role";
const CURR_SHOP_KEY= "currentShopId";

export const DEFAULT_SHOP_ID = "__default_shop__";
const MAX_RECENT_CATS = 12;

// token only in localStorage
const TOKEN_KEY = "CFP_auth_token";

// ===============================================================
// IndexedDB + Memory Cache (sync API) —— single-file version
// ===============================================================
type KVDB = IDBPDatabase;
const DB_NAME = "carbon-manager";
const DB_VERSION = 1;
const STORE_KV = "kv";

// sync memory cache
const CACHE = new Map<string, string>();

let dbPromise: Promise<KVDB> | null = null;
async function getDB(): Promise<KVDB> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldV) {
        if (oldV < 1) db.createObjectStore(STORE_KV); // key: string, value: string
      },
    });
  }
  return dbPromise;
}

async function hydrateCacheFromIDB() {
  const db = await getDB();
  const tx = db.transaction(STORE_KV, "readonly");
  const store = tx.objectStore(STORE_KV);
  const [keys, values] = await Promise.all([store.getAllKeys(), store.getAll()]);
  for (let i = 0; i < keys.length; i++) {
    const k = String(keys[i]);
    const v = String(values[i] ?? "");
    CACHE.set(k, v);
  }
  await tx.done;
}

async function migrateLocalStorageIntoIDBIfEmpty() {
  if (CACHE.size > 0) return;
  const db = await getDB();
  const tx = db.transaction(STORE_KV, "readwrite");
  const store = tx.objectStore(STORE_KV);

  // move non-token data; token stays in localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (k === TOKEN_KEY) continue;
    const v = localStorage.getItem(k);
    if (v != null) {
      await store.put(v, k);
      CACHE.set(k, v);
    }
  }
  await tx.done;
}

let readyDone = false;
/** Call once on app start: IDB -> memory cache + one-time localStorage migration */
export async function initStorage(): Promise<void> {
  if (readyDone) return;
  await hydrateCacheFromIDB();
  await migrateLocalStorageIntoIDBIfEmpty();
  readyDone = true;
}

/** Sync storage API with write-through IDB */
const storage = {
  getItem(key: string): string | null {
    return CACHE.has(key) ? CACHE.get(key)! : null;
  },
  setItem(key: string, value: string): void {
    CACHE.set(key, value);
    void (async () => {
      const db = await getDB();
      const tx = db.transaction(STORE_KV, "readwrite");
      await tx.objectStore(STORE_KV).put(value, key);
      await tx.done;
    })();
  },
  removeItem(key: string): void {
    CACHE.delete(key);
    void (async () => {
      const db = await getDB();
      const tx = db.transaction(STORE_KV, "readwrite");
      await tx.objectStore(STORE_KV).delete(key);
      await tx.done;
    })();
  },
  keys(): string[] {
    return Array.from(CACHE.keys());
  },
};

// ===============================================================
// Tiny Event Emitter (same-tab)
// ===============================================================
type StageCfgChangedPayload = { shopId: string; productId: string; cfg: StageConfig[] };
type StepOrderChangedPayload = { shopId: string; productId: string; stageId: string; order: string[] };

type BusMap = {
  "stagecfg:changed": StageCfgChangedPayload;
  "steporder:changed": StepOrderChangedPayload;
  "account:deleted": { accountId: string };
};
type BusHandler<K extends keyof BusMap> = (p: BusMap[K]) => void;

const Emitter = (() => {
  const map = new Map<string, Set<Function>>();
  return {
    on<K extends keyof BusMap>(type: K, fn: BusHandler<K>) {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type)!.add(fn);
      return () => map.get(type)?.delete(fn);
    },
    emit<K extends keyof BusMap>(type: K, payload: BusMap[K]) {
      const set = map.get(type);
      if (!set) return;
      for (const fn of set) (fn as any)(payload);
    },
  };
})();

export function onStageConfigChanged(fn: BusHandler<"stagecfg:changed">) {
  return Emitter.on("stagecfg:changed", fn);
}
export function onStepOrderChanged(fn: BusHandler<"steporder:changed">) {
  return Emitter.on("steporder:changed", fn);
}
export function onAccountDeleted(fn: BusHandler<"account:deleted">) {
  return Emitter.on("account:deleted", fn);
}

// ===============================================================
// Utils
// ===============================================================
function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key: string, value: any) {
  storage.setItem(key, JSON.stringify(value));
}
const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));
const isBlank = (s?: string | null) => !s || String(s).trim() === "";

function ensureShopId(input?: string): string {
  const sid = input ?? AuthStore.getCurrentShopId() ?? DEFAULT_SHOP_ID;
  return sid;
}
export const getCurrentShopIdSafe = () => ensureShopId();

function uid(prefix = ""): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let id = "";
  for (let i = 0; i < b.length; i++) id += chars[b[i] & 63];
  return prefix ? `${prefix}_${id}` : id;
}
function normalizePid(pid: number | string): string {
  if (typeof pid === "number") return String(pid);
  return String(pid || "").trim();
}

// ===============================================================
// Key Helpers
// ===============================================================
const Key = {
  products: (shopId: string) => `shop_${shopId}_products`,
  records:  (shopId: string, pid: string) => `shop_${shopId}_records_${pid}`,
  categories:(shopId: string) => `shop_${shopId}_categories`,
  recentCats:(shopId: string) => `shop_${shopId}_recent_cat_ids`,
  stageCfg:  (shopId: string, productId: string) => `stage_config:${shopId}:${productId}`,
  stepOrder: (shopId: string, productId: string, stageId: string) =>
    `step_order:${shopId}:${productId}:${stageId}`,
  notes: (acc: string) => `notes_${acc}`,
};

// ===============================================================
// Stores / Services
// ===============================================================

// -------- AuthStore (token only in localStorage) ----------------
const LEGACY_CURR_ACC_KEY = "current_account";

const AuthStore = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(v: string | null) {
    if (v == null || v === "") localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, v);
  },

  getAccount(): string { return storage.getItem(CURR_ACC_KEY) || ""; },
  setAccount(v: string) { storage.setItem(CURR_ACC_KEY, v); },
  clearAccount() { storage.removeItem(CURR_ACC_KEY); },

  getRole(): Role { return (storage.getItem(CURR_ROLE_KEY) as Role) || "None"; },
  setRole(v: Role) { storage.setItem(CURR_ROLE_KEY, v); },

  getCurrentShopId(): string | null { return storage.getItem(CURR_SHOP_KEY); },
  setCurrentShopId(id: string) {
    storage.setItem(CURR_SHOP_KEY, id);
    const acc = AuthStore.getAccount();
    if (!acc) return;
    const metas = AccountStore.getAccountsMeta();
    if (metas[acc]) {
      metas[acc].currentShopId = id;
      AccountStore.saveAccountsMeta(metas);
    }
  },

  softLogout() {
    // clear auth state but keep app data
    storage.removeItem(CURR_ACC_KEY);
    storage.removeItem(CURR_ROLE_KEY);
    storage.removeItem(CURR_SHOP_KEY);
    localStorage.removeItem(TOKEN_KEY);
  },

  migrateLegacyAuthKeys() {
    try {
      const legacy = storage.getItem(LEGACY_CURR_ACC_KEY);
      if (legacy && !storage.getItem(CURR_ACC_KEY)) {
        storage.setItem(CURR_ACC_KEY, legacy);
      }
      if (legacy) storage.removeItem(LEGACY_CURR_ACC_KEY);

      const acc = AuthStore.getAccount();
      const meta = acc ? AccountStore.getAccountsMeta()[acc] : undefined;
      const currentRole = AuthStore.getRole();
      if (acc && meta && currentRole === "None" && meta.role && meta.role !== "None") {
        AuthStore.setRole(meta.role);
      }
    } catch (e) {
      console.warn("[migrateLegacyAuthKeys] error:", e);
    }
  },
};

// -------- AccountStore --------------------------------------------------------
const AccountStore = {
  getAccountsMeta(): Record<string, AccountMeta> {
    return loadJSON<Record<string, AccountMeta>>(ACCOUNTS_KEY, {});
  },
  saveAccountsMeta(obj: Record<string, AccountMeta>) {
    saveJSON(ACCOUNTS_KEY, obj);
  },
  exists(account: string): boolean {
    return !!AccountStore.getAccountsMeta()[account];
  },
  create(account: string, password: string, role: Role = "None") {
    const metas = AccountStore.getAccountsMeta();
    if (metas[account]) throw new Error("帳號已存在");
    metas[account] = { role, password, shopIds: [] };
    AccountStore.saveAccountsMeta(metas);
  },
  verifyLogin(account: string, password: string): boolean {
    const meta = AccountStore.getAccountsMeta()[account];
    return !!meta && meta.password === password;
  },
  setRoleOf(account: string, role: Role) {
    const metas = AccountStore.getAccountsMeta();
    if (!metas[account]) return;
    metas[account].role = role;
    AccountStore.saveAccountsMeta(metas);
  },
  getAllIds(): string[] {
    try { return Object.keys(AccountStore.getAccountsMeta() || {}); } catch { return []; }
  },
};

// -------- ShopStore -----------------------------------------------------------
const ShopStore = {
  getMap(): Record<string, TeaShop> {
    return loadJSON<Record<string, TeaShop>>(SHOPS_KEY, {});
  },
  saveMap(obj: Record<string, TeaShop>) { saveJSON(SHOPS_KEY, obj); },

  isNameTaken(name: string): boolean {
    return Object.values(ShopStore.getMap()).some(s => s.name === name);
  },

  create(name: string, owner: string): TeaShop {
    const shops = ShopStore.getMap();
    if (ShopStore.isNameTaken(name)) throw new Error("茶行名稱已被使用");

    const id = "shop_" + Date.now();
    shops[id] = { id, name, owner };
    ShopStore.saveMap(shops);

    const metas = AccountStore.getAccountsMeta();
    const meta: AccountMeta = metas[owner] ?? { role: "Farmer" };
    meta.shopIds = uniq([...(meta.shopIds ?? []), id]);
    meta.currentShopId = id;
    metas[owner] = meta;
    AccountStore.saveAccountsMeta(metas);

    AuthStore.setCurrentShopId(id);
    return shops[id];
  },

  delete(shopId: string) {
    const shops = ShopStore.getMap();
    const shop  = shops[shopId];
    if (!shop) return;

    // remove all data under this shop
    CleanupService.clearShopAllData(shopId);

    // remove from owner meta and adjust currentShopId if needed
    const metas = AccountStore.getAccountsMeta();
    const ownerMeta = metas[shop.owner];
    if (ownerMeta) {
      ownerMeta.shopIds = (ownerMeta.shopIds || []).filter(id => id !== shopId);
      if (ownerMeta.currentShopId === shopId) {
        ownerMeta.currentShopId = ownerMeta.shopIds?.[0] || undefined;
        if (AuthStore.getAccount() === shop.owner) {
          if (ownerMeta.currentShopId) AuthStore.setCurrentShopId(ownerMeta.currentShopId);
          else storage.removeItem(CURR_SHOP_KEY);
        }
      }
      metas[shop.owner] = ownerMeta;
      AccountStore.saveAccountsMeta(metas);
    }

    delete shops[shopId];
    ShopStore.saveMap(shops);
  },

  listMine(account: string): TeaShop[] {
    return Object.values(ShopStore.getMap()).filter(s => s.owner === account);
  },
  listAll(): TeaShop[] { return Object.values(ShopStore.getMap()); },
};

// -------- ProductStore & RecordStore -----------------------------------------
const ProductStore = {
  load(shopId?: string): Product[] {
    const sid = ensureShopId(shopId);
    return loadJSON<Product[]>(Key.products(sid), []);
  },
  save(list: Product[], shopId?: string) {
    const sid = ensureShopId(shopId);
    saveJSON(Key.products(sid), list);
  },

  nextSerialNo(products: Product[]): number {
    const used = new Set(products.map(p => p.serialNo).filter((n): n is number => Number.isFinite(n)));
    let n = 1;
    while (used.has(n)) n++;
    return n;
  },

  add(shopId?: string, name?: string, categoryId?: string | null): Product {
    const sid = ensureShopId(shopId);
    const list = ProductStore.load(sid);
    const p: Product = {
      id: uid("prod"),
      name: (name ?? "").trim() || "未命名商品",
      serialNo: ProductStore.nextSerialNo(list),
      categoryId: categoryId ?? null,
    };
    ProductStore.save([...list, p], sid);
    return p;
  },

  duplicate(shopId: string, srcPid: string | number, newName?: string) {
    const sid = ensureShopId(shopId);
    const products = ProductStore.load(sid);

    const srcId = String(srcPid);
    const src = products.find(p => p.id === srcId);
    if (!src) throw new Error("找不到來源商品");

    const newProd: Product = {
      id: uid("prod"),
      name: (newName?.trim() || `${src.name} (複製)`),
      serialNo: ProductStore.nextSerialNo(products),
      categoryId: src?.categoryId ?? null,
    };
    ProductStore.save([...products, newProd], sid);

    // clone records
    const nowMs  = Date.now();
    const nowSec = Math.floor(nowMs / 1000);
    const srcRecords = RecordStore.load(srcId, sid) || [];

    const clonedRecords = (srcRecords as any[]).map((r: any, i: number) => ({
      ...r,
      id: `${nowMs}-${i}`,
      productId: newProd.id,
      timestamp: nowSec,
      date: new Date(nowMs).toISOString(),
    }));

    RecordStore.save(newProd.id, clonedRecords, sid);
    return newProd;
  },

  rename(shopId: string, pid: string | number, newName: string) {
    const sid = ensureShopId(shopId);
    const pidStr = normalizePid(pid);
    const list = ProductStore.load(sid);
    const idx = list.findIndex(p => p.id === pidStr);
    if (idx === -1) throw new Error("找不到此商品");
    list[idx] = { ...list[idx], name: newName };
    ProductStore.save(list, sid);
  },

  findIdByAnyIdent(shopId: string, ident: string | number): string | null {
    const sid = ensureShopId(shopId);
    const products = ProductStore.load(sid);
    const s = String(ident).trim();

    const byId = products.find(p => p.id === s);
    if (byId) return byId.id;

    const n = Number(s);
    if (Number.isFinite(n)) {
      const bySerial = products.find(p => p.serialNo === n);
      if (bySerial) return bySerial.id;
    }

    const legacy = products.find(p => String((p as any)._legacyNumId) === s);
    return legacy?.id ?? null;
  },

  delete(shopId: string, pid: string | number) {
    const sid = ensureShopId(shopId);
    const ident = String(pid).trim();
    const realId = ProductStore.findIdByAnyIdent(sid, ident) ?? ident;

    const products = ProductStore.load(sid);
    const next = products.filter(p => p.id !== realId);
    ProductStore.save(next, sid);

    storage.removeItem(Key.records(sid, realId));
    if (ident !== realId) storage.removeItem(Key.records(sid, ident));

    StageConfigStore.removeForProduct(sid, realId);
    StepOrderStore.removeAllForProduct(sid, realId);
    if (ident !== realId) {
      StageConfigStore.removeForProduct(sid, ident);
      StepOrderStore.removeAllForProduct(sid, ident);
    }

    CleanupService.sweepOrphanDataForShop(sid);
  },

  debugPrint(shopId?: string) {
    const sid = ensureShopId(shopId);
    const list = ProductStore.load(sid);
    console.table(list.map(p => ({ id: p.id, name: p.name, serialNo: p.serialNo })));
  },
};

const RecordStore = {
  load(pid: number | string, shopId?: string) {
    const sid = ensureShopId(shopId);
    const pidStr = normalizePid(pid);
    if (!pidStr) {
      console.warn("[loadRecords] empty productId, return []", { sid, pid });
      return [];
    }
    const key = Key.records(sid, pidStr);
    const list = loadJSON<any[]>(key, []);
    return Array.isArray(list) ? list : [];
  },

  save(pid: number | string, list: any[], shopId?: string) {
    const sid = ensureShopId(shopId);
    const pidStr = normalizePid(pid);
    if (!pidStr) {
      console.warn("[saveRecords] empty productId, skip", { sid, pid });
      return;
    }
    const key = Key.records(sid, pidStr);
    try {
      saveJSON(key, Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("[saveRecords] write failed", { key, e });
    }
  },

  update(productId: string, shopId: string, recordId: string, patch: Partial<LifeRecord>) {
    const list = RecordStore.load(productId, shopId) as LifeRecord[];
    const idx = list.findIndex(r => r.id === recordId);
    if (idx === -1) return list;
    const nowTs = Math.floor(Date.now() / 1000);

    list[idx] = {
      ...list[idx],
      ...patch,
      timestamp: nowTs,
      date: new Date(nowTs * 1000).toISOString(),
    };
    RecordStore.save(productId, list, shopId);
    return list;
  },

  delete(productId: string, shopId: string, recordId: string) {
    const list = RecordStore.load(productId, shopId) as LifeRecord[];
    const next = list.filter(r => r.id !== recordId);
    RecordStore.save(productId, next, shopId);
    return next;
  },

  upsert(rec: { id?: string; productId: number | string; [k: string]: any }, shopId?: string): any[] {
    const sid = ensureShopId(shopId);
    const pidStr = normalizePid(rec?.productId ?? "");
    if (!pidStr) {
      console.warn("[upsertLifeRecord] missing productId, skip", rec);
      return [];
    }

    const list = RecordStore.load(pidStr, sid) as any[];

    const nowMs  = Date.now();
    const nowSec = Math.floor(nowMs / 1000);

    let next: any[];
    if (rec.id) {
      const idx = list.findIndex(r => r.id === rec.id);
      if (idx >= 0) {
        next = [...list];
        next[idx] = { ...list[idx], ...rec, productId: pidStr, updatedAt: nowSec };
      } else {
        const newRec = {
          ...rec,
          id: rec.id,
          productId: pidStr,
          timestamp: rec.timestamp ?? nowSec,
          date: rec.date ?? new Date(nowMs).toISOString(),
          updatedAt: nowSec,
        };
        next = [...list, newRec];
      }
    } else {
      const newRec = {
        ...rec,
        id: `${nowMs}-${Math.random().toString(36).slice(2, 8)}`,
        productId: pidStr,
        timestamp: rec.timestamp ?? nowSec,
        date: rec.date ?? new Date(nowMs).toISOString(),
        updatedAt: nowSec,
      };
      next = [...list, newRec];
    }

    RecordStore.save(pidStr, next, sid);
    return next;
  },
};

// -------- StepOrderStore ------------------------------------------------------
const StepOrderStore = {
  load(shopId: string, productId: string | number, stageId: string): string[] | null {
    const sid = ensureShopId(shopId);
    const pid = normalizePid(productId);
    if (isBlank(pid) || isBlank(stageId)) return null;
    const key = Key.stepOrder(sid, pid, stageId);
    try {
      const raw = storage.getItem(key);
      if (!raw) return null;
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? (arr as string[]) : null;
    } catch { return null; }
  },

  save(shopId: string, productId: string | number, stageId: string, orderedStepIds: string[]) {
    const sid = ensureShopId(shopId);
    const pid = normalizePid(productId);
    if (isBlank(pid) || isBlank(stageId)) return;
    const key = Key.stepOrder(sid, pid, stageId);
    storage.setItem(key, JSON.stringify(orderedStepIds || []));
    Emitter.emit("steporder:changed", { shopId: sid, productId: pid, stageId, order: orderedStepIds || [] });
  },

  ensureFromSteps(shopId: string, productId: string | number, stageId: string, steps: { id: string }[]): string[] {
    const sid = ensureShopId(shopId);
    const pid = normalizePid(productId);
    const cur = StepOrderStore.load(sid, pid, stageId);
    const incomingIds = steps.map(s => s.id);
    if (cur && cur.length) {
      const incomingSet = new Set(incomingIds);
      const filtered = cur.filter(id => incomingSet.has(id));
      const missing  = incomingIds.filter(id => !filtered.includes(id));
      const merged   = [...filtered, ...missing];
      if (JSON.stringify(merged) !== JSON.stringify(cur)) {
        StepOrderStore.save(sid, pid, stageId, merged);
      }
      return merged;
    }
    StepOrderStore.save(sid, pid, stageId, incomingIds);
    return incomingIds;
  },

  removeAllForProduct(shopId: string, productId: string | number) {
    const sid = ensureShopId(shopId);
    const pid = normalizePid(productId);
    const prefix = `step_order:${sid}:${pid}:`;
    storage.keys()
      .filter(k => k.startsWith(prefix))
      .forEach(k => storage.removeItem(k));
  },
};

// -------- CategoryStore -------------------------------------------------------
const CategoryStore = {
  normalizeName(s: string) { return (s ?? "").trim().toLowerCase(); },
  nameTaken(list: Category[], name: string, excludeId?: string) {
    const norm = CategoryStore.normalizeName(name);
    return list.some(c => CategoryStore.normalizeName(c.name) === norm && c.id !== excludeId);
  },

  load(shopId?: string): Category[] {
    const sid = ensureShopId(shopId);
    return loadJSON<Category[]>(Key.categories(sid), []);
  },
  save(shopId?: string, list?: Category[]) {
    const sid = ensureShopId(shopId);
    const arr = Array.isArray(list) ? list : [];
    saveJSON(Key.categories(sid), arr);
  },

  isNameTaken(shopId: string, name: string, excludeId?: string) {
    const sid = ensureShopId(shopId);
    const list = CategoryStore.load(sid);
    return CategoryStore.nameTaken(list, name, excludeId);
  },

  add(shopId: string, name: string) {
    const sid = ensureShopId(shopId);
    const list = CategoryStore.load(sid);
    const trimmed = name.trim();
    if (!trimmed) throw new Error("名稱不可為空");
    if (CategoryStore.nameTaken(list, trimmed)) throw new Error("分類名稱已存在");

    const maxOrder = list.length ? Math.max(...list.map(c => c.order)) : -1;
    const newCat: Category = { id: "cat_" + Date.now(), name: trimmed, order: maxOrder + 1 };
    CategoryStore.save(sid, [...list, newCat]);
    return newCat;
  },

  rename(shopId: string, catId: string, newName: string) {
    const sid = ensureShopId(shopId);
    const list = CategoryStore.load(sid);
    const idx = list.findIndex(c => c.id === catId);
    if (idx === -1) return;

    const trimmed = newName.trim();
    if (!trimmed) throw new Error("名稱不可為空");
    if (CategoryStore.nameTaken(list, trimmed, catId)) throw new Error("分類名稱已存在");
    list[idx] = { ...list[idx], name: trimmed };
    CategoryStore.save(sid, list);
  },

  deleteAndUnassign(shopId: string, catId: string) {
    const sid = ensureShopId(shopId);
    const list = CategoryStore.load(sid).filter(c => c.id !== catId);
    CategoryStore.save(sid, list);

    const products = ProductStore.load(sid).map(p =>
      p.categoryId === catId ? { ...p, categoryId: null } : p
    );
    ProductStore.save(products, sid);
  },

  setProductCategory(shopId: string, pid: string | number, catId: string | null) {
    const sid   = ensureShopId(shopId);
    const ident = normalizePid(pid);
    const realId = ProductStore.findIdByAnyIdent(sid, ident) ?? ident;

    const list = ProductStore.load(sid);
    const idx  = list.findIndex(p => p.id === realId);
    if (idx === -1) throw new Error("找不到商品");

    list[idx] = { ...list[idx], categoryId: catId };
    ProductStore.save(list, sid);
  },

  move(shopId: string, catId: string, direction: "up" | "down") {
    const sid = ensureShopId(shopId);
    const list = CategoryStore.load(sid).sort((a,b)=>a.order-b.order);
    const idx = list.findIndex(c => c.id === catId);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === list.length - 1) return;

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    const tmp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = tmp;

    const reordered = list.map((c, i) => ({ ...c, order: i }));
    CategoryStore.save(sid, reordered);
  },

  setOrder(shopId: string, newOrderIds: string[]) {
    const sid = ensureShopId(shopId);
    const list = CategoryStore.load(sid);
    const map = new Map(list.map(c=>[c.id,c]));
    const reordered: Category[] = [];
    newOrderIds.forEach((id, i)=>{
      const c = map.get(id);
      if (c) reordered.push({ ...c, order: i });
      map.delete(id);
    });
    const rest = Array.from(map.values());
    rest.forEach((c, i)=>reordered.push({ ...c, order: reordered.length + i }));
    CategoryStore.save(sid, reordered);
  },

  search(shopId: string, query: string): Category[] {
    const sid = ensureShopId(shopId);
    const q = (query ?? "").trim().toLowerCase();
    const list = CategoryStore.load(sid).sort((a,b)=>a.order-b.order);
    if (!q) return list;
    return list.filter(c => c.name.toLowerCase().includes(q));
  },

  getRecentIds(shopId?: string): string[] {
    const sid = ensureShopId(shopId);
    try {
      return JSON.parse(storage.getItem(Key.recentCats(sid)) || "[]");
    } catch {
      return [];
    }
  },
  pushRecentId(catId: string | null | undefined, shopId?: string) {
    const sid = ensureShopId(shopId);
    if (!catId) return;
    const cur = CategoryStore.getRecentIds(sid);
    const next = [catId, ...cur.filter(id => id !== catId)].slice(0, MAX_RECENT_CATS);
    storage.setItem(Key.recentCats(sid), JSON.stringify(next));
  },
};

// -------- NoteStore -----------------------------------------------------------
const NoteStore = {
  load(acc: string): NoteItem[] {
    if (!acc) return [];
    try {
      return JSON.parse(storage.getItem(Key.notes(acc)) || "[]");
    } catch { return []; }
  },
  save(acc: string, list: NoteItem[]) {
    if (!acc) return;
    storage.setItem(Key.notes(acc), JSON.stringify(list));
  },
};

// -------- StageConfigStore ----------------------------------------------------
function cloneTemplate(): StageConfig[] {
  return JSON.parse(JSON.stringify(FIXED_STAGE_TEMPLATES));
}
function deepClone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }
function setStepLabel(step: any, newLabel: string) {
  if ("label" in step) step.label = newLabel;
  else if ("name" in step) step.name = newLabel;
  else step.label = newLabel;
}

const StageConfigStore = {
  load(shopId?: string, productId?: string): StageConfig[] {
    const sid = ensureShopId(shopId);
    const pid = String(productId ?? "").trim();

    const emptyKey = Key.stageCfg(sid, "");
    if (storage.getItem(emptyKey)) storage.removeItem(emptyKey);

    if (isBlank(pid)) return cloneTemplate();

    const key = Key.stageCfg(sid, pid);
    try {
      const raw = storage.getItem(key);
      if (!raw) {
        const tpl = cloneTemplate();
        storage.setItem(key, JSON.stringify(tpl));
        tpl.forEach(s => StepOrderStore.ensureFromSteps(sid, pid, (s as any).id, (s as any).steps || []));
        Emitter.emit("stagecfg:changed", { shopId: sid, productId: pid, cfg: deepClone(tpl) });
        return tpl;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        const tpl = cloneTemplate();
        storage.setItem(key, JSON.stringify(tpl));
        tpl.forEach(s => StepOrderStore.ensureFromSteps(sid, pid, (s as any).id, (s as any).steps || []));
        Emitter.emit("stagecfg:changed", { shopId: sid, productId: pid, cfg: deepClone(tpl) });
        return tpl;
      }
      (parsed as any[]).forEach(s =>
        StepOrderStore.ensureFromSteps(sid, pid, s.id, (s.steps ?? []))
      );
      return parsed as StageConfig[];
    } catch {
      const tpl = cloneTemplate();
      storage.setItem(key, JSON.stringify(tpl));
      tpl.forEach(s => StepOrderStore.ensureFromSteps(sid, pid, (s as any).id, (s as any).steps || []));
      Emitter.emit("stagecfg:changed", { shopId: sid, productId: pid, cfg: deepClone(tpl) });
      return tpl;
    }
  },

  save(shopId?: string, productId?: string, cfg?: StageConfig[]) {
    const sid = ensureShopId(shopId);
    const pid = String(productId ?? "").trim();
    if (isBlank(pid)) return;
    const key = Key.stageCfg(sid, pid);
    const data = Array.isArray(cfg) && cfg.length > 0 ? cfg : cloneTemplate();
    storage.setItem(key, JSON.stringify(data));
    (data as any[]).forEach(s => {
      const steps = (s.steps ?? []) as { id: string }[];
      StepOrderStore.ensureFromSteps(sid, pid, s.id, steps);
    });
    Emitter.emit("stagecfg:changed", { shopId: sid, productId: pid, cfg: deepClone(data) });
  },

  reset(shopId?: string, productId?: string): StageConfig[] {
    const sid = ensureShopId(shopId);
    const pid = String(productId ?? "").trim();
    if (isBlank(pid)) return cloneTemplate();
    const key = Key.stageCfg(sid, pid);
    const tpl = cloneTemplate();
    storage.setItem(key, JSON.stringify(tpl));
    tpl.forEach(s => StepOrderStore.ensureFromSteps(sid, pid, (s as any).id, (s as any).steps || []));
    Emitter.emit("stagecfg:changed", { shopId: sid, productId: pid, cfg: deepClone(tpl) });
    return tpl;
  },

  removeForProduct(shopId: string, productId: string) {
    const sid = ensureShopId(shopId);
    const pid = String(productId).trim();
    const emptyKey = Key.stageCfg(sid, "");
    if (storage.getItem(emptyKey)) storage.removeItem(emptyKey);
    if (!pid) return;

    const newKey = Key.stageCfg(sid, pid);
    if (storage.getItem(newKey)) storage.removeItem(newKey);

    const legacyKey1 = `stage_config::${pid}`;
    if (storage.getItem(legacyKey1)) storage.removeItem(legacyKey1);

    const legacyKey2 = `stage_config::__default_shop__:${pid}`;
    if (storage.getItem(legacyKey2)) storage.removeItem(legacyKey2);
  },
};

// -------- Cleanup / Migration -------------------------------------------------
const RemoveByPattern = (regex: RegExp) => {
  storage.keys().forEach(k => { if (regex.test(k)) storage.removeItem(k); });
};

const CleanupService = {
  clearShopAllData(shopId: string) {
    const sid = ensureShopId(shopId);

    const products: Product[] = loadJSON<Product[]>(Key.products(sid), []);
    products.forEach(p => {
      storage.removeItem(Key.records(sid, p.id));
      StageConfigStore.removeForProduct(sid, p.id);
      StepOrderStore.removeAllForProduct(sid, p.id);
    });

    storage.removeItem(Key.products(sid));
    storage.removeItem(Key.categories(sid));
    storage.removeItem(Key.recentCats(sid));

    CleanupService.sweepOrphanDataForShop(sid);
  },

  sweepOrphanDataForShop(shopId?: string): { removedRecords: number; removedStageCfg: number; removedStepOrders: number; removedWeird: number } {
    const sid = ensureShopId(shopId);
    const productIds = new Set(ProductStore.load(sid).map(p => String(p.id)));

    let removedRecords = 0;
    let removedStageCfg = 0;
    let removedStepOrders = 0;
    let removedWeird   = 0;

    for (const key of storage.keys()) {
      {
        const m = key.match(/^shop_(.+?)_records_(.+)$/);
        if (m && m[1] === sid) {
          const pid = m[2];
          if (!productIds.has(pid)) {
            storage.removeItem(key);
            removedRecords++;
          }
        }
      }
      {
        const m = key.match(/^stage_config:(.+?):(.*)$/);
        if (m && m[1] === sid) {
          const pid = m[2];
          if (isBlank(pid) || !productIds.has(pid)) {
            storage.removeItem(key);
            removedStageCfg++;
          }
        }
      }
      {
        const m = key.match(/^step_order:(.+?):(.+?):(.+)$/);
        if (m && m[1] === sid) {
          const pid = m[2];
          if (!productIds.has(pid)) {
            storage.removeItem(key);
            removedStepOrders++;
          }
        }
      }
      if (key.startsWith("stage_config::")) {
        const pid = key.split("::")[1] || "";
        if (isBlank(pid) || ![...productIds].some(id => id === pid)) {
          storage.removeItem(key);
          removedStageCfg++;
        }
      }
      if (/^shop__records_/.test(key)) {
        storage.removeItem(key);
        removedWeird++;
      }
    }

    if (removedRecords || removedStageCfg || removedStepOrders || removedWeird) {
      console.info("[sweepOrphanDataForShop] removed", { sid, removedRecords, removedStageCfg, removedStepOrders, removedWeird });
    }
    return { removedRecords, removedStageCfg, removedStepOrders, removedWeird };
  },

  sweepAllShopsLegacyWeirdKeys() {
    const ids = new Set<string>();
    storage.keys().forEach(k => {
      const m = k.match(/^shop_(.+?)_(products|categories|records_.+)$/);
      if (m) ids.add(m[1]);
    });
    ids.add(DEFAULT_SHOP_ID);
    Object.values(ShopStore.getMap()).forEach(s => ids.add(s.id));
    if (storage.getItem("frequentProducts")) storage.removeItem("frequentProducts");
    ids.forEach(sid => CleanupService.sweepOrphanDataForShop(sid));
  },

  clearAllAppDataButKeepMigrations() {
    const APP_KEY_PREFIXES = [
      "shop__", "shop_", "stage_config:", "step_order:", "target:",
    ];
    APP_KEY_PREFIXES.forEach(p =>
      RemoveByPattern(new RegExp(`^${p.replace(/([:*_])/g, "\\$1")}`))
    );

    RemoveByPattern(/^shop_.*_batches$/);

    [ TOKEN_KEY, CURR_ACC_KEY, CURR_ROLE_KEY, CURR_SHOP_KEY, SHOPS_KEY ].forEach(k => {
      if (k === TOKEN_KEY) localStorage.removeItem(k); else storage.removeItem(k);
    });
    // storage.removeItem(ACCOUNTS_KEY); // keep accounts unless you want a full nuke
  },

  clearShopsData(shopIds: string[]) {
    shopIds.forEach((sid) => {
      const esc = sid.replace(/([:*_])/g, "\\$1");

      RemoveByPattern(new RegExp(`^shop_${esc}_`));
      RemoveByPattern(new RegExp(`^stage_config:${esc}:`));
      RemoveByPattern(new RegExp(`^step_order:${esc}:`));
      RemoveByPattern(new RegExp(`^target:${esc}:`));
      RemoveByPattern(new RegExp(`^shop_${esc}_batches$`));

      if (sid === DEFAULT_SHOP_ID) {
        RemoveByPattern(/^stage_config:__default_shop__:/);
        RemoveByPattern(/^shop____default_shop___/);
        RemoveByPattern(/^shop__default_shop__/);
        RemoveByPattern(/^shop____default_shop___batches$/);
        RemoveByPattern(/^shop__default_shop__batches$/);
      }
    });
    shopIds.forEach(sid => CleanupService.sweepOrphanDataForShop(sid));
  },

  hardAppReset() { CleanupService.clearAllAppDataButKeepMigrations(); },

  hardAppNuke()  {
    RemoveByPattern(/^shop__/);
    RemoveByPattern(/^shop_/);
    RemoveByPattern(/^stage_config:/);
    RemoveByPattern(/^step_order:/);
    RemoveByPattern(/^target:/);
    RemoveByPattern(/^notes_/);
    RemoveByPattern(/_batches$/);

    [
      TOKEN_KEY,
      CURR_ACC_KEY, CURR_ROLE_KEY, CURR_SHOP_KEY,
      SHOPS_KEY, ACCOUNTS_KEY,
      "__migrated_multi_shop__", "__migrated_uid_pk__",
      LEGACY_CURR_ACC_KEY,
    ].forEach(k => {
      if (k === TOKEN_KEY) localStorage.removeItem(k); else storage.removeItem(k);
    });
  },
};

const MigrationService = {
  migrateLegacyData() {
    if (!storage.getItem("__migrated_multi_shop__")) {
      const oldProductsRaw = storage.getItem("products");
      if (oldProductsRaw) {
        let acc = AuthStore.getAccount();
        if (!acc) { acc = "legacy_user"; AuthStore.setAccount(acc); }
        if (AuthStore.getRole() === "None") AuthStore.setRole("Farmer");

        const metas = AccountStore.getAccountsMeta();
        if (!metas[acc]) metas[acc] = { role: "Farmer", password: "" };
        AccountStore.saveAccountsMeta(metas);

        const shop = ShopStore.create("我的茶行", acc);
        const products: any[] = JSON.parse(oldProductsRaw);
        saveJSON(Key.products(shop.id), products);

        products.forEach(p => {
          const recRaw = storage.getItem(`records_${p.id}`);
          if (recRaw) {
            saveJSON(Key.records(shop.id, String(p.id)), JSON.parse(recRaw));
            storage.removeItem(`records_${p.id}`);
          }
        });

        storage.removeItem("products");
      }
      storage.setItem("__migrated_multi_shop__", "1");
    }

    if (!storage.getItem("__migrated_uid_pk__")) {
      const shopIds = new Set<string>();
      for (const k of storage.keys()) {
        const m = k.match(/^shop_(.+?)_products$/);
        if (m) shopIds.add(m[1]);
      }
      shopIds.add(DEFAULT_SHOP_ID);

      let migratedCount = 0;

      for (const sid of shopIds) {
        const products = loadJSON<any[]>(Key.products(sid), []);
        if (!Array.isArray(products) || products.length === 0) continue;

        const need = products.filter(p => typeof p?.id !== "string");
        if (need.length === 0) continue;

        const idMap = new Map<string, string>();
        const newList: Product[] = products.map((p: any) => {
          const oldIdStr = String(p.id);
          const newId = uid("prod");
          idMap.set(oldIdStr, newId);
          migratedCount++;
          return {
            id: newId,
            name: p.name ?? "未命名商品",
            serialNo: Number.isFinite(p.serialNo) ? p.serialNo : undefined,
            categoryId: p.categoryId ?? null,
          };
        });

        const used = new Set(newList.map(x => x.serialNo).filter((n): n is number => Number.isFinite(n)));
        let n = 1;
        for (const p of newList) {
          if (p.serialNo == null) {
            while (used.has(n)) n++;
            p.serialNo = n++;
          }
        }

        saveJSON(Key.products(sid), newList);

        for (const [oldIdStr, newId] of idMap.entries()) {
          const oldKey = Key.records(sid, oldIdStr);
          const list = loadJSON<any[]>(oldKey, null as any);
          if (list) {
            const rewritten = list.map(r => ({ ...r, productId: newId }));
            saveJSON(Key.records(sid, newId), rewritten);
            storage.removeItem(oldKey);
          }
        }
      }

      storage.setItem("__migrated_uid_pk__", "1");
      if (migratedCount > 0) {
        console.info(`[migrateLegacyData] migrated ${migratedCount} products to string IDs.`);
      }
    }

    CleanupService.sweepAllShopsLegacyWeirdKeys();
  },

  bootStorageHousekeeping() {
    AuthStore.migrateLegacyAuthKeys();
    CleanupService.sweepAllShopsLegacyWeirdKeys();

    const metas = AccountStore.getAccountsMeta();
    if (!metas || Object.keys(metas).length === 0) {
      CleanupService.hardAppNuke();
    }
  },
};

// -------- BrowseableShops -----------------------------------------------------
const BrowseService = {
  listBrowsableShops(): TeaShop[] {
    const map = ShopStore.getMap();
    const registered = Object.values(map);

    const hasDataForShop = (sid: string) => {
      const prods = loadJSON<Product[]>(Key.products(sid), []);
      const cats  = loadJSON<Category[]>(Key.categories(sid), []);
      const anyRecord = storage.keys().some(k => k.startsWith(`shop_${sid}_records_`));
      const anyStage  = storage.keys().some(k => k.startsWith(`stage_config:${sid}:`));
      const anyOrder  = storage.keys().some(k => k.startsWith(`step_order:${sid}:`));
      return prods.length > 0 || cats.length > 0 || anyRecord || anyStage || anyOrder;
    };

    const inferred: TeaShop[] = [];
    for (const k of storage.keys()) {
      const m1 = k.match(/^shop_(.+?)_products$/);
      const m2 = k.match(/^shop_(.+?)_categories$/);
      const sid = (m1?.[1] ?? m2?.[1]) || null;
      if (!sid) continue;
      if (map[sid]) continue;
      if (!hasDataForShop(sid)) continue;
      inferred.push({ id: sid, name: `未知茶行（${sid}）`, owner: "(unknown)"});
    }

    const extras: TeaShop[] =
      hasDataForShop(DEFAULT_SHOP_ID) && !map[DEFAULT_SHOP_ID]
        ? [{ id: DEFAULT_SHOP_ID, name: "預設茶行", owner: "(system)" }]
        : [];

    const all: Record<string, TeaShop> = {};
    [...registered, ...inferred, ...extras].forEach(s => { all[s.id] = s; });

    const list = Object.values(all).sort((a, b) => {
      if (a.id === DEFAULT_SHOP_ID) return -1;
      if (b.id === DEFAULT_SHOP_ID) return 1;
      return a.name.localeCompare(b.name);
    });

    return list;
  },
};

// ===============================================================
// AccountService (high-level account deletion facade)
// ===============================================================
type DeleteAccountMode = "local-only" | "remote+local" | "dry-run";
type DeleteAccountResult =
  | { ok: true; mode: DeleteAccountMode; deletedAccount?: string; previewKeys?: string[] }
  | { ok: false; mode: DeleteAccountMode; reason: string };

function collectLocalKeysOfAccount(accountId: string): string[] {
  const keys: string[] = [];

  // account-bound notes
  keys.push(Key.notes(accountId));

  // scan shops for this account (metas are source of truth)
  const metas = AccountStore.getAccountsMeta();
  const mineIds = new Set((metas[accountId]?.shopIds) ?? []);

  // direct scan by key prefix to avoid missing legacy keys
  storage.keys().forEach(k => {
    // shop-scoped data
    const m1 = k.match(/^shop_(.+?)_(products|categories|records_.+|batches)$/);
    if (m1 && mineIds.has(m1[1])) keys.push(k);
    // stage config / step order (shop-scoped)
    const m2 = k.match(/^stage_config:([^:]+):/);
    if (m2 && mineIds.has(m2[1])) keys.push(k);
    const m3 = k.match(/^step_order:([^:]+):/);
    if (m3 && mineIds.has(m3[1])) keys.push(k);
    // legacy/target leftovers
    if (k.startsWith("target:")) keys.push(k);
  });

  // auth-related state
  keys.push(CURR_ACC_KEY, CURR_ROLE_KEY, CURR_SHOP_KEY);

  return Array.from(new Set(keys));
}

export const AccountService = {
  /**
   * Delete current account.
   * - local-only: clear local app data of the user (default)
   * - remote+local: call backend first, then clear local (TODO wire API)
   * - dry-run: preview which keys would be removed
   */
  async deleteSelf(mode: DeleteAccountMode = "local-only"): Promise<DeleteAccountResult> {
    const id = AuthStore.getAccount();
    if (!id) return { ok: false, mode, reason: "no-current-account" };

    if (mode === "dry-run") {
      const previewKeys = collectLocalKeysOfAccount(id);
      return { ok: true, mode, previewKeys };
    }

    if (mode === "remote+local") {
      try {
        // TODO: call backend to delete/disable the account
        // await http.delete(`/users/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${AuthStore.getToken()}` }});
      } catch (_e) {
        return { ok: false, mode, reason: "remote-failed" };
      }
    }

    // local cleanup
    deleteAccountCompletely(id);

    // broadcast event for UI (e.g., UserContext to softLogout + redirect)
    Emitter.emit("account:deleted", { accountId: id });

    return { ok: true, mode, deletedAccount: id };
  },
};

// ===============================================================
// Public API (kept compatible with your existing imports)
// ===============================================================

// Auth / Role / Token
export const getAccount        = () => AuthStore.getAccount();
export const setAccount        = (v: string) => AuthStore.setAccount(v);
export const clearAccount      = () => AuthStore.clearAccount();
export const getRole           = (): Role => AuthStore.getRole();
export const setRole           = (v: Role) => AuthStore.setRole(v);
export const getCurrentShopId  = () => AuthStore.getCurrentShopId();
export const setCurrentShopId  = (id: string) => AuthStore.setCurrentShopId(id);
export const getToken          = () => AuthStore.getToken();
export const setToken          = (t: string | null) => AuthStore.setToken(t);

// Accounts
export const getAccountsMeta   = () => AccountStore.getAccountsMeta();
export const saveAccountsMeta  = (obj: Record<string, AccountMeta>) => AccountStore.saveAccountsMeta(obj);
export const accountExists     = (account: string) => AccountStore.exists(account);
export const createAccount     = (a: string, p: string, r: Role = "None") => AccountStore.create(a, p, r);
export const verifyLogin       = (a: string, p: string) => AccountStore.verifyLogin(a, p);
export const setRoleOf         = (a: string, r: Role) => AccountStore.setRoleOf(a, r);
export const getAllAccountIds  = () => AccountStore.getAllIds();

// Shops
export const getShopsMap       = () => ShopStore.getMap();
export const saveShopsMap      = (obj: Record<string, TeaShop>) => ShopStore.saveMap(obj);
export const isShopNameTaken   = (name: string) => ShopStore.isNameTaken(name);
export const createShop        = (name: string, owner: string) => ShopStore.create(name, owner);
export const deleteShop        = (shopId: string) => ShopStore.delete(shopId);
export const listMyShops       = (account: string) => ShopStore.listMine(account);
export const listAllShops      = () => ShopStore.listAll();

// Products / Records
export const loadProducts      = (shopId?: string) => ProductStore.load(shopId);
export const saveProducts      = (list: Product[], shopId?: string) => ProductStore.save(list, shopId);
export const addProduct        = (shopId?: string, name?: string, categoryId?: string | null) => ProductStore.add(shopId, name, categoryId);
export const duplicateProduct  = (shopId: string, srcPid: string | number, newName?: string) => ProductStore.duplicate(shopId, srcPid, newName);
export const renameProduct     = (shopId: string, pid: string | number, newName: string) => ProductStore.rename(shopId, pid, newName);
export const findProductIdByAnyIdent = (shopId: string, ident: string | number) => ProductStore.findIdByAnyIdent(shopId, ident);
export const deleteProduct     = (shopId: string, pid: string | number) => ProductStore.delete(shopId, pid);

export const loadRecords       = (pid: number | string, shopId?: string) => RecordStore.load(pid, shopId);
export const saveRecords       = (pid: number | string, list: any[], shopId?: string) => RecordStore.save(pid, list, shopId);
export const updateRecord      = (productId: string, shopId: string, recordId: string, patch: Partial<LifeRecord>) => RecordStore.update(productId, shopId, recordId, patch);
export const deleteRecord      = (productId: string, shopId: string, recordId: string) => RecordStore.delete(productId, shopId, recordId);
export interface LifeRecordUpsert { id?: string; productId: number | string; [k: string]: any; }
export const upsertLifeRecord  = (rec: LifeRecordUpsert, shopId?: string) => RecordStore.upsert(rec, shopId);

// Categories
export const loadCategories    = (shopId?: string) => CategoryStore.load(shopId);
export const saveCategories    = (shopId?: string, list?: Category[]) => CategoryStore.save(shopId, list);
export const isCategoryNameTaken = (shopId: string, name: string, excludeId?: string) => CategoryStore.isNameTaken(shopId, name, excludeId);
export const addCategory       = (shopId: string, name: string) => CategoryStore.add(shopId, name);
export const renameCategory    = (shopId: string, catId: string, newName: string) => CategoryStore.rename(shopId, catId, newName);
export const deleteCategoryAndUnassign = (shopId: string, catId: string) => CategoryStore.deleteAndUnassign(shopId, catId);
export const setProductCategory = (shopId: string, pid: string | number, catId: string | null) => CategoryStore.setProductCategory(shopId, pid, catId);
export const moveCategory      = (shopId: string, catId: string, direction: "up" | "down") => CategoryStore.move(shopId, catId, direction);
export const setCategoriesOrder= (shopId: string, newOrderIds: string[]) => CategoryStore.setOrder(shopId, newOrderIds);
export const searchCategories  = (shopId: string, q: string) => CategoryStore.search(shopId, q);
export const getRecentCategoryIds = (shopId?: string) => CategoryStore.getRecentIds(shopId);
export const pushRecentCategoryId = (catId: string | null | undefined, shopId?: string) => CategoryStore.pushRecentId(catId, shopId);

// Notes
export const loadNotes         = (acc: string) => NoteStore.load(acc);
export const saveNotes         = (acc: string, list: NoteItem[]) => NoteStore.save(acc, list);

// Migration & Cleanup
export const migrateLegacyAuthKeys = () => AuthStore.migrateLegacyAuthKeys();
export const migrateLegacyData     = () => MigrationService.migrateLegacyData();
export const bootStorageHousekeeping = () => MigrationService.bootStorageHousekeeping(); // ← 加這行
export const sweepOrphanDataForShop= (shopId?: string) => CleanupService.sweepOrphanDataForShop(shopId);
export const debugPrintProducts    = (shopId?: string) => ProductStore.debugPrint(shopId);


// Stage Config
export const loadStageConfig   = (shopId?: string, productId?: string) => StageConfigStore.load(shopId, productId);
export const saveStageConfig   = (shopId?: string, productId?: string, cfg?: StageConfig[]) => StageConfigStore.save(shopId, productId, cfg);
export const resetStageConfig  = (shopId?: string, productId?: string) => StageConfigStore.reset(shopId, productId);

// Step Order
export const loadStepOrder     = (shopId: string, productId: string | number, stageId: string) => StepOrderStore.load(shopId, productId, stageId);
export const saveStepOrder     = (shopId: string, productId: string | number, stageId: string, orderedStepIds: string[]) => StepOrderStore.save(shopId, productId, stageId, orderedStepIds);
export const ensureStepOrderFromSteps = (shopId: string, productId: string | number, stageId: string, steps: { id: string }[]) =>
  StepOrderStore.ensureFromSteps(shopId, productId, stageId, steps);

// Step edit helpers
export function renameStep(shopId: string, productId: string | number, stageId: string, stepId: string, newLabel: string): StageConfig[] {
  const sid = ensureShopId(shopId);
  const pid = normalizePid(productId);
  const cfg = StageConfigStore.load(sid, pid) as any[];
  const sIdx = cfg.findIndex(s => s.id === stageId);
  if (sIdx < 0) return cfg;
  const steps = (cfg[sIdx].steps ?? []) as any[];
  const stIdx = steps.findIndex(st => st.id === stepId);
  if (stIdx < 0) return cfg;

  const trimmed = (newLabel ?? "").trim();
  setStepLabel(steps[stIdx], trimmed || "未命名步驟");

  const nextCfg = [...cfg];
  nextCfg[sIdx] = { ...cfg[sIdx], steps: [...steps] };
  StageConfigStore.save(sid, pid, nextCfg);
  return deepClone(nextCfg);
}

export function deleteStep(shopId: string, productId: string | number, stageId: string, stepId: string): StageConfig[] {
  const sid = ensureShopId(shopId);
  const pid = normalizePid(productId);
  const cfg = StageConfigStore.load(sid, pid) as any[];
  const sIdx = cfg.findIndex(s => s.id === stageId);
  if (sIdx < 0) return cfg;

  const steps = (cfg[sIdx].steps ?? []) as any[];
  const nextSteps = steps.filter(st => st.id !== stepId);
  if (nextSteps.length === steps.length) return cfg;

  const nextCfg = [...cfg];
  nextCfg[sIdx] = { ...cfg[sIdx], steps: nextSteps };
  StageConfigStore.save(sid, pid, nextCfg);
  return deepClone(nextCfg);
}

export function addStep(shopId: string, productId: string | number, stageId: string, label: string, tag?: any): StageConfig[] {
  const sid = ensureShopId(shopId);
  const pid = normalizePid(productId);
  const cfg = StageConfigStore.load(sid, pid) as any[];
  const sIdx = cfg.findIndex(s => s.id === stageId);
  if (sIdx < 0) return cfg;

  const steps = (cfg[sIdx].steps ?? []) as any[];
  const newStepId = uid("step");
  const newStep: any = { id: newStepId, label: (label ?? "").trim() || "未命名步驟" };
  if (tag !== undefined) newStep.tag = tag;

  const nextCfg = [...cfg];
  nextCfg[sIdx] = { ...cfg[sIdx], steps: [...steps, newStep] };
  StageConfigStore.save(sid, pid, nextCfg);
  return deepClone(nextCfg);
}

// Browseable Shops
export const listBrowsableShops    = () => BrowseService.listBrowsableShops();

// Login / Logout (local-only; when API ready, just setToken on login)
export function softLogout() { AuthStore.softLogout(); }
export function login(account: string, password: string): boolean {
  const metas = AccountStore.getAccountsMeta();
  const meta = metas[account];
  if (!meta || meta.password !== password) return false;

  AuthStore.setAccount(account);
  AuthStore.setRole(meta.role || "None");
  const sid = meta.currentShopId || (meta.shopIds?.[0]) || DEFAULT_SHOP_ID;
  AuthStore.setCurrentShopId(sid);
  return true;
}
export function logout() {
  AuthStore.softLogout();
}

// Account/shop cleanup & hard reset utilities
export function clearAllAppDataButKeepMigrations() { CleanupService.clearAllAppDataButKeepMigrations(); }
export function clearShopsData(shopIds: string[]) { CleanupService.clearShopsData(shopIds); }
export function deleteAccountCompletely(accountId: string) {
  const metas = AccountStore.getAccountsMeta();
  const meta  = metas[accountId];
  if (!meta) return;

  CleanupService.clearShopsData(meta.shopIds ?? []);

  const shopsMap = ShopStore.getMap();
  (meta.shopIds ?? []).forEach(id => delete shopsMap[id]);
  ShopStore.saveMap(shopsMap);

  storage.removeItem(Key.notes(accountId));

  delete metas[accountId];
  AccountStore.saveAccountsMeta(metas);

  if (AuthStore.getAccount() === accountId) {
    [TOKEN_KEY, CURR_ACC_KEY, CURR_ROLE_KEY, CURR_SHOP_KEY].forEach(k => {
      if (k === TOKEN_KEY) localStorage.removeItem(k); else storage.removeItem(k);
    });
  }

  CleanupService.sweepAllShopsLegacyWeirdKeys();

  if (Object.keys(metas).length === 0) {
    CleanupService.hardAppNuke();
  }
}
export function deleteAllAccountsCompletely() {
  AccountStore.getAllIds().forEach(id => deleteAccountCompletely(id));
  storage.removeItem(ACCOUNTS_KEY);
  storage.removeItem(SHOPS_KEY);
  [TOKEN_KEY, CURR_ACC_KEY, CURR_ROLE_KEY, CURR_SHOP_KEY].forEach(k => {
    if (k === TOKEN_KEY) localStorage.removeItem(k); else storage.removeItem(k);
  });
  RemoveByPattern(/^target:/);
  RemoveByPattern(/^shop_.*_batches$/);
  RemoveByPattern(/^shop___default_shop___batches$/);
  RemoveByPattern(/^shop__default_shop__batches$/);
  CleanupService.sweepAllShopsLegacyWeirdKeys();
}
export function hardAppReset() { CleanupService.hardAppReset(); }
export function hardAppNuke()  { CleanupService.hardAppNuke(); }

// Utilities
function getAllExistingShopIds(): Set<string> {
  const ids = new Set<string>();
  Object.keys(getShopsMap() || {}).forEach(id => ids.add(id));
  for (const k of storage.keys()) {
    const m = k.match(/^shop_(.+?)_(products|categories|records_.+)$/);
    if (m) ids.add(m[1]);
  }
  ids.add(DEFAULT_SHOP_ID);
  return ids;
}

export function purgeStrayTargetsAndLegacyBatches(opts?: { includeDefault?: boolean }) {
  const { includeDefault = false } = opts || {};
  const existingShopIds = getAllExistingShopIds();

  const toDel: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;

    if (k.startsWith("target:")) {
      const m = k.match(/^target:([^:]+):(.+)$/);
      if (m) {
        const sid = m[1];
        const pid = m[2];

        const isDefault = (sid === "__default_shop__");
        if (isDefault && !includeDefault) {
          // keep
        } else if (!existingShopIds.has(sid)) {
          toDel.push(k);
        } else {
          const prods = loadJSON<Product[]>(`shop_${sid}_products`, []);
          const found = prods.some(p => String(p.id) === String(pid));
          if (!found) toDel.push(k);
        }
      }
    }

    if (/^shop___default_shop___batches$/.test(k) || /^shop__default_shop__batches$/.test(k)) {
      toDel.push(k);
    }
  }

  toDel.forEach(k => localStorage.removeItem(k));
  if (toDel.length) {
    console.info("[purgeStrayTargetsAndLegacyBatches] removed:", toDel.length, toDel);
  }
}

export function getStepOrderPayload(stages: { id: string; steps: { id: string }[] }[]) {
  return stages.map((s) => ({ stageId: s.id, order: s.steps.map((step) => step.id) }));
}
