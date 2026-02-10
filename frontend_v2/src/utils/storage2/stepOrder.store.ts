// src/utils/storage/stepOrder.store.ts
import { storage } from "./port";
import { Emitter } from "./emitter";
import { ensureShopId, normalizePid, isBlank } from "./utils";
import { Key } from "./keys";

export const StepOrderStore = {
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
    for (const k of ((): string[] => {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const kk = localStorage.key(i);
        if (kk) keys.push(kk);
      }
      return keys;
    })()) {
      if (k.startsWith(prefix)) localStorage.removeItem(k);
    }
  },
};
