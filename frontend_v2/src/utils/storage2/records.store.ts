// src/utils/storage/records.store.ts
import { DEFAULT_SHOP_ID, Key } from "./keys";
import { ensureShopId, loadJSON, saveJSON, normalizePid } from "./utils";
import type { LifeRecord } from "./types";

export const RecordStore = {
  load(pid: number | string, shopId?: string) {
    const sid = ensureShopId(shopId);
    const pidStr = normalizePid(pid);
    if (!pidStr) {
      console.warn("[loadRecords] 空的 productId，返回空陣列", { sid, pid });
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
      console.warn("[saveRecords] 空的 productId，略過寫入", { sid, pid });
      return;
    }
    const key = Key.records(sid, pidStr);
    try {
      saveJSON(key, Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("[saveRecords] 寫入失敗", { key, e });
    }
    if (sid === DEFAULT_SHOP_ID) {
      console.info("[saveRecords] 寫入在 DEFAULT_SHOP_ID 命名空間", { key });
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
      console.warn("[upsertLifeRecord] productId 缺失，略過", rec);
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
