// src/utils/storage/stageConfig.store.ts
import { Key } from "./keys";
import { Emitter } from "./emitter";
import { ensureShopId, isBlank } from "./utils";
import { StepOrderStore } from "./stepOrder.store";
import { FIXED_STAGE_TEMPLATES, StageConfig } from "./types";

const cloneTemplate = (): StageConfig[] => JSON.parse(JSON.stringify(FIXED_STAGE_TEMPLATES));
const deepClone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const StageConfigStore = {
  load(shopId?: string, productId?: string): StageConfig[] {
    const sid = ensureShopId(shopId);
    const pid = String(productId ?? "").trim();

    const emptyKey = Key.stageCfg(sid, "");
    if (localStorage.getItem(emptyKey)) localStorage.removeItem(emptyKey);

    if (isBlank(pid)) return cloneTemplate();

    const key = Key.stageCfg(sid, pid);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        const tpl = cloneTemplate();
        localStorage.setItem(key, JSON.stringify(tpl));
        tpl.forEach(s => StepOrderStore.ensureFromSteps(sid, pid, (s as any).id, (s as any).steps || []));
        Emitter.emit("stagecfg:changed", { shopId: sid, productId: pid, cfg: deepClone(tpl) });
        return tpl;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        const tpl = cloneTemplate();
        localStorage.setItem(key, JSON.stringify(tpl));
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
      localStorage.setItem(key, JSON.stringify(tpl));
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
    localStorage.setItem(key, JSON.stringify(data));
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
    localStorage.setItem(key, JSON.stringify(tpl));
    tpl.forEach(s => StepOrderStore.ensureFromSteps(sid, pid, (s as any).id, (s as any).steps || []));
    Emitter.emit("stagecfg:changed", { shopId: sid, productId: pid, cfg: deepClone(tpl) });
    return tpl;
  },

  removeForProduct(shopId: string, productId: string) {
    const sid = ensureShopId(shopId);
    const pid = String(productId).trim();
    const emptyKey = Key.stageCfg(sid, "");
    if (localStorage.getItem(emptyKey)) localStorage.removeItem(emptyKey);
    if (!pid) return;

    const newKey = Key.stageCfg(sid, pid);
    if (localStorage.getItem(newKey)) localStorage.removeItem(newKey);

    const legacyKey1 = `stage_config::${pid}`;
    if (localStorage.getItem(legacyKey1)) localStorage.removeItem(legacyKey1);

    const legacyKey2 = `stage_config::__default_shop__:${pid}`;
    if (localStorage.getItem(legacyKey2)) localStorage.removeItem(legacyKey2);
  },
};

// helpers for step edit
export function setStepLabel(step: any, newLabel: string) {
  if ("label" in step) step.label = newLabel;
  else if ("name" in step) step.name = newLabel;
  else step.label = newLabel;
}
export const deepCloneCfg = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
