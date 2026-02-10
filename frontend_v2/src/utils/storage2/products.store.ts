// src/utils/storage/products.store.ts
import { Key } from "./keys";
import { ensureShopId, loadJSON, saveJSON, normalizePid, uid } from "./utils";
import type { Product } from "./types";
import { RecordStore } from "./records.store";
import { StageConfigStore } from "./stageConfig.store";
import { StepOrderStore } from "./stepOrder.store";
import { CleanupService } from "./cleanup.service";

export const ProductStore = {
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

    const srcId = normalizePid(srcPid);
    const src = products.find(p => p.id === srcId);
    if (!src) throw new Error("找不到來源商品");

    const newProd: Product = {
      id: uid("prod"),
      name: (newName?.trim() || `${src.name} (複製)`),
      serialNo: ProductStore.nextSerialNo(products),
      categoryId: src?.categoryId ?? null,
    };
    ProductStore.save([...products, newProd], sid);

    // Clone records with new product
    const nowMs  = Date.now();
    const nowSec = Math.floor(nowMs / 1000);
    const srcRecords = RecordStore.load(srcId, sid) || [];
    const cloned = (srcRecords as any[]).map((r: any, i: number) => ({
      ...r,
      id: `${nowMs}-${i}`,
      productId: newProd.id,
      timestamp: nowSec,
      date: new Date(nowMs).toISOString(),
    }));
    RecordStore.save(newProd.id, cloned, sid);
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

    // cascade
    localStorage.removeItem(Key.records(sid, realId));
    if (ident !== realId) localStorage.removeItem(Key.records(sid, ident));

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
