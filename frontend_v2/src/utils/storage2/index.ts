// src/utils/storage/index.ts
// ---------- Types ----------
export type {
  Role,
  AccountMeta,
  TeaShop,
  Product,
  Category,
  NoteItem,
  StageConfig,
  LifeRecord,
} from "./types";
export { FIXED_STAGE_TEMPLATES } from "./types";

// ---------- Constants / helpers ----------
export { DEFAULT_SHOP_ID } from "./keys";
export { getCurrentShopIdSafe } from "./utils";

// ---------- Events ----------
export { onStageConfigChanged, onStepOrderChanged } from "./emitter";

// ---------- Internal stores/services ----------
import { AuthStore } from "./auth.store";
import { AccountStore } from "./accounts.store";
import { ShopStore } from "./shops.store";
import { ProductStore } from "./products.store";
import { RecordStore } from "./records.store";
import { CategoryStore } from "./categories.store";
import { NoteStore } from "./notes.store";
import { StepOrderStore } from "./stepOrder.store";
import { StageConfigStore, setStepLabel, deepCloneCfg } from "./stageConfig.store";
import { CleanupService } from "./cleanup.service";
import { MigrationService } from "./migrations.service";
import { BrowseService } from "./browse.service";

// ---------- Public API (compat with old storage.ts) ----------

// Auth / Role
import type { Role, AccountMeta, Product, Category, LifeRecord } from "./types";

export const getAccount       = () => AuthStore.getAccount();
export const setAccount       = (v: string) => AuthStore.setAccount(v);
export const clearAccount     = () => AuthStore.clearAccount();
export const getRole          = (): Role => AuthStore.getRole();
export const setRole          = (v: Role) => AuthStore.setRole(v);
export const getCurrentShopId = () => AuthStore.getCurrentShopId();
export const setCurrentShopId = (id: string) => AuthStore.setCurrentShopId(id);

// Accounts
export const getAccountsMeta  = () => AccountStore.getAccountsMeta();
export const saveAccountsMeta = (obj: Record<string, AccountMeta>) => AccountStore.saveAccountsMeta(obj);
export const accountExists    = (account: string) => AccountStore.exists(account);
export const createAccount    = (a: string, p: string, r: Role = "None") => AccountStore.create(a, p, r);
export const verifyLogin      = (a: string, p: string) => AccountStore.verifyLogin(a, p);
export const setRoleOf        = (a: string, r: Role) => AccountStore.setRoleOf(a, r);

// Shops
export const getShopsMap      = () => ShopStore.getMap();
export const saveShopsMap     = (obj: Record<string, any>) => ShopStore.saveMap(obj);
export const isShopNameTaken  = (name: string) => ShopStore.isNameTaken(name);
export const createShop       = (name: string, owner: string) => ShopStore.create(name, owner);
export const deleteShop       = (shopId: string) => ShopStore.delete(shopId);
export const listMyShops      = (account: string) => ShopStore.listMine(account);
export const listAllShops     = () => ShopStore.listAll();

// Products
export const loadProducts     = (shopId?: string) => ProductStore.load(shopId);
export const saveProducts     = (list: Product[], shopId?: string) => ProductStore.save(list, shopId);
export const addProduct       = (shopId?: string, name?: string, categoryId?: string | null) =>
  ProductStore.add(shopId, name, categoryId);
export const duplicateProduct = (shopId: string, srcPid: string | number, newName?: string) =>
  ProductStore.duplicate(shopId, srcPid, newName);
export const renameProduct    = (shopId: string, pid: string | number, newName: string) =>
  ProductStore.rename(shopId, pid, newName);
export const findProductIdByAnyIdent = (shopId: string, ident: string | number) =>
  ProductStore.findIdByAnyIdent(shopId, ident);
export const deleteProduct    = (shopId: string, pid: string | number) => ProductStore.delete(shopId, pid);

// Records
export const loadRecords      = (pid: number | string, shopId?: string) => RecordStore.load(pid, shopId);
export const saveRecords      = (pid: number | string, list: any[], shopId?: string) =>
  RecordStore.save(pid, list, shopId);
export const updateRecord     = (productId: string, shopId: string, recordId: string, patch: Partial<LifeRecord>) =>
  RecordStore.update(productId, shopId, recordId, patch);
export const deleteRecord     = (productId: string, shopId: string, recordId: string) =>
  RecordStore.delete(productId, shopId, recordId);
export interface LifeRecordUpsert { id?: string; productId: number | string; [k: string]: any; }
export const upsertLifeRecord = (rec: LifeRecordUpsert, shopId?: string) => RecordStore.upsert(rec, shopId);

// Categories
export const loadCategories   = (shopId?: string) => CategoryStore.load(shopId);
export const saveCategories   = (shopId?: string, list?: Category[]) => CategoryStore.save(shopId, list);
export const isCategoryNameTaken = (shopId: string, name: string, excludeId?: string) =>
  CategoryStore.isNameTaken(shopId, name, excludeId);
export const addCategory      = (shopId: string, name: string) => CategoryStore.add(shopId, name);
export const renameCategory   = (shopId: string, catId: string, newName: string) =>
  CategoryStore.rename(shopId, catId, newName);
export const deleteCategoryAndUnassign = (shopId: string, catId: string) =>
  CategoryStore.deleteAndUnassign(shopId, catId);
export const setProductCategory = (shopId: string, pid: string | number, catId: string | null) =>
  CategoryStore.setProductCategory(shopId, pid, catId);
export const moveCategory     = (shopId: string, catId: string, direction: "up" | "down") =>
  CategoryStore.move(shopId, catId, direction);
export const setCategoriesOrder = (shopId: string, newOrderIds: string[]) =>
  CategoryStore.setOrder(shopId, newOrderIds);
export const searchCategories = (shopId: string, q: string) => CategoryStore.search(shopId, q);
export const getRecentCategoryIds = (shopId?: string) => CategoryStore.getRecentIds(shopId);
export const pushRecentCategoryId = (catId: string | null | undefined, shopId?: string) =>
  CategoryStore.pushRecentId(catId, shopId);

// Notes
export const loadNotes        = (acc: string) => NoteStore.load(acc);
export const saveNotes        = (acc: string, list: any[]) => NoteStore.save(acc, list);

// Stage Config
export const loadStageConfig  = (shopId?: string, productId?: string) => StageConfigStore.load(shopId, productId);
export const saveStageConfig  = (shopId?: string, productId?: string, cfg?: any[]) =>
  StageConfigStore.save(shopId, productId, cfg);
export const resetStageConfig = (shopId?: string, productId?: string) => StageConfigStore.reset(shopId, productId);

// Step Order
export const loadStepOrder    = (shopId: string, productId: string | number, stageId: string) =>
  StepOrderStore.load(shopId, productId, stageId);
export const saveStepOrder    = (shopId: string, productId: string | number, stageId: string, orderedStepIds: string[]) =>
  StepOrderStore.save(shopId, productId, stageId, orderedStepIds);
export const ensureStepOrderFromSteps = (
  shopId: string,
  productId: string | number,
  stageId: string,
  steps: { id: string }[],
) => StepOrderStore.ensureFromSteps(shopId, productId, stageId, steps);

// Step edit APIs
export function renameStep(
  shopId: string,
  productId: string | number,
  stageId: string,
  stepId: string,
  newLabel: string,
) {
  const sid = shopId;
  const pid = String(productId);
  const cfg = StageConfigStore.load(sid, pid) as any[];
  const sIdx = cfg.findIndex((s) => s.id === stageId);
  if (sIdx < 0) return cfg;
  const steps = (cfg[sIdx].steps ?? []) as any[];
  const stIdx = steps.findIndex((st) => st.id === stepId);
  if (stIdx < 0) return cfg;

  const trimmed = (newLabel ?? "").trim();
  setStepLabel(steps[stIdx], trimmed || "未命名步驟");

  const nextCfg = [...cfg];
  nextCfg[sIdx] = { ...cfg[sIdx], steps: [...steps] };
  StageConfigStore.save(sid, pid, nextCfg);
  return deepCloneCfg(nextCfg);
}

export function deleteStep(
  shopId: string,
  productId: string | number,
  stageId: string,
  stepId: string,
) {
  const sid = shopId;
  const pid = String(productId);
  const cfg = StageConfigStore.load(sid, pid) as any[];
  const sIdx = cfg.findIndex((s) => s.id === stageId);
  if (sIdx < 0) return cfg;

  const steps = (cfg[sIdx].steps ?? []) as any[];
  const nextSteps = steps.filter((st) => st.id !== stepId);
  if (nextSteps.length === steps.length) return cfg;

  const nextCfg = [...cfg];
  nextCfg[sIdx] = { ...cfg[sIdx], steps: nextSteps };
  StageConfigStore.save(sid, pid, nextCfg);
  return deepCloneCfg(nextCfg);
}

export function addStep(
  shopId: string,
  productId: string | number,
  stageId: string,
  label: string,
  tag?: any,
) {
  const sid = shopId;
  const pid = String(productId);
  const cfg = StageConfigStore.load(sid, pid) as any[];
  const sIdx = cfg.findIndex((s) => s.id === stageId);
  if (sIdx < 0) return cfg;

  const steps = (cfg[sIdx].steps ?? []) as any[];
  const newStepId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const newStep: any = { id: newStepId, label: (label ?? "").trim() || "未命名步驟" };
  if (tag !== undefined) newStep.tag = tag;

  const nextCfg = [...cfg];
  nextCfg[sIdx] = { ...cfg[sIdx], steps: [...steps, newStep] };
  StageConfigStore.save(sid, pid, nextCfg);
  return deepCloneCfg(nextCfg);
}

// Migration & Cleanup / Dev helpers
export const migrateLegacyAuthKeys   = () => AuthStore.migrateLegacyAuthKeys();
export const migrateLegacyData       = () => MigrationService.migrateLegacyData();
export const sweepOrphanDataForShop  = (shopId?: string) => CleanupService.sweepOrphanDataForShop(shopId);
export const debugPrintProducts      = (shopId?: string) => ProductStore.debugPrint(shopId);

// Browseable Shops
export const listBrowsableShops      = () => BrowseService.listBrowsableShops();

// Logout / Login flows
export function softLogout() { AuthStore.softLogout(); }
export function login(account: string, password: string): boolean {
  const metas = AccountStore.getAccountsMeta();
  const meta = metas[account];
  if (!meta || meta.password !== password) return false;

  AuthStore.setAccount(account);
  AuthStore.setRole(meta.role || "None");
  const sid = meta.currentShopId || meta.shopIds?.[0] || DEFAULT_SHOP_ID;
  AuthStore.setCurrentShopId(sid);
  return true;
}
export function logout() {
  AuthStore.softLogout();
  // Keep token cleanup here (do not depend on internal keys)
  localStorage.removeItem("CFP_auth_token");
}

// Account/shop cleanup & hard reset utilities
export function clearAllAppDataButKeepMigrations() { CleanupService.clearAllAppDataButKeepMigrations(); }
export function clearShopsData(shopIds: string[]) { CleanupService.clearShopsData(shopIds); }
export function deleteAccountCompletely(accountId: string) {
  const metas = AccountStore.getAccountsMeta();
  const meta = metas[accountId];
  if (!meta) return;

  CleanupService.clearShopsData(meta.shopIds ?? []);

  const shopsMap = ShopStore.getMap();
  (meta.shopIds ?? []).forEach((id) => delete shopsMap[id]);
  ShopStore.saveMap(shopsMap);

  localStorage.removeItem(`notes_${accountId}`);
  delete metas[accountId];
  AccountStore.saveAccountsMeta(metas);

  if (AuthStore.getAccount() === accountId) {
    localStorage.removeItem("CFP_auth_token");
    AuthStore.softLogout();
  }

  CleanupService.sweepAllShopsLegacyWeirdKeys();
  if (Object.keys(metas).length === 0) {
    CleanupService.hardAppNuke();
  }
}
export function hardAppReset() { CleanupService.hardAppReset(); }
export function hardAppNuke()  { CleanupService.hardAppNuke(); }
export function getAllAccountIds(): string[] { return AccountStore.getAllIds(); }
export function deleteAllAccountsCompletely() {
  AccountStore.getAllIds().forEach((id) => deleteAccountCompletely(id));
  localStorage.removeItem("accounts_meta");
  localStorage.removeItem("shops_map");

  // purge known leftovers
  localStorage.removeItem("CFP_auth_token");
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    keys.push(k);
  }
  keys.forEach((k) => {
    if (
      /^target:/.test(k) ||
      /^shop_.*_batches$/.test(k) ||
      /^shop___default_shop___batches$/.test(k) ||
      /^shop__default_shop__batches$/.test(k)
    ) {
      localStorage.removeItem(k);
    }
  });
  CleanupService.sweepAllShopsLegacyWeirdKeys();
}
export function bootStorageHousekeeping() { MigrationService.bootStorageHousekeeping(); }

// Backward-compat alias
export function deleteAccount(accountId: string) { return deleteAccountCompletely(accountId); }

// Utilities used by purge helper
function getAllExistingShopIds(): Set<string> {
  const ids = new Set<string>();
  Object.keys(ShopStore.getMap() || {}).forEach((id) => ids.add(id));
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
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
        const isDefault = sid === "__default_shop__";
        if (isDefault && !includeDefault) {
          // keep default namespace
        } else if (!existingShopIds.has(sid)) {
          toDel.push(k);
        } else {
          const prods = JSON.parse(localStorage.getItem(`shop_${sid}_products`) || "[]");
          const found = Array.isArray(prods) && prods.some((p: any) => String(p.id) === String(pid));
          if (!found) toDel.push(k);
        }
      }
    }

    if (/^shop___default_shop___batches$/.test(k) || /^shop__default_shop__batches$/.test(k)) {
      toDel.push(k);
    }
  }

  toDel.forEach((k) => localStorage.removeItem(k));
  if (toDel.length) {
    console.info("[purgeStrayTargetsAndLegacyBatches] removed:", toDel.length, toDel);
  }
}

export function getStepOrderPayload(stages: { id: string; steps: { id: string }[] }[]) {
  return stages.map((s) => ({ stageId: s.id, order: s.steps.map((step) => step.id) }));
}
