// src/utils/storage/cleanup.service.ts
import { storage } from "./port";
import { DEFAULT_SHOP_ID, Key, SHOPS_KEY, ACCOUNTS_KEY } from "./keys";
import { ensureShopId, loadJSON } from "./utils";
import type { Product, Category } from "./types";
import { ProductStore } from "./products.store";
import { StageConfigStore } from "./stageConfig.store";
import { StepOrderStore } from "./stepOrder.store";
import { ShopStore } from "./shops.store";
import { AuthStore } from "./auth.store";

const RemoveByPattern = (regex: RegExp) => {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) keys.push(k);
  }
  keys.forEach(k => { if (regex.test(k)) localStorage.removeItem(k); });
};

export const CleanupService = {
  clearShopAllData(shopId: string) {
    const sid = ensureShopId(shopId);

    const products: Product[] = loadJSON<Product[]>(Key.products(sid), []);
    products.forEach(p => {
      localStorage.removeItem(Key.records(sid, p.id));
      StageConfigStore.removeForProduct(sid, p.id);
      StepOrderStore.removeAllForProduct(sid, p.id);
    });

    localStorage.removeItem(Key.products(sid));
    localStorage.removeItem(Key.categories(sid));
    localStorage.removeItem(Key.recentCats(sid));

    CleanupService.sweepOrphanDataForShop(sid);
  },

  sweepOrphanDataForShop(shopId?: string) {
    const sid = ensureShopId(shopId);
    const productIds = new Set(ProductStore.load(sid).map(p => String(p.id)));

    let removedRecords = 0;
    let removedStageCfg = 0;
    let removedStepOrders = 0;
    let removedWeird   = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;

      {
        const m = key.match(/^shop_(.+?)_records_(.+)$/);
        if (m && m[1] === sid) {
          const pid = m[2];
          if (!productIds.has(pid)) {
            localStorage.removeItem(key);
            removedRecords++;
          }
        }
      }
      {
        const m = key.match(/^stage_config:(.+?):(.*)$/);
        if (m && m[1] === sid) {
          const pid = m[2];
          if (!pid || !productIds.has(pid)) {
            localStorage.removeItem(key);
            removedStageCfg++;
          }
        }
      }
      {
        const m = key.match(/^step_order:(.+?):(.+?):(.+)$/);
        if (m && m[1] === sid) {
          const pid = m[2];
          if (!productIds.has(pid)) {
            localStorage.removeItem(key);
            removedStepOrders++;
          }
        }
      }
      if (key.startsWith("stage_config::")) {
        const pid = key.split("::")[1] || "";
        if (!pid || ![...productIds].some(id => id === pid)) {
          localStorage.removeItem(key);
          removedStageCfg++;
        }
      }
      if (/^shop__records_/.test(key)) {
        localStorage.removeItem(key);
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
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      const m = k.match(/^shop_(.+?)_(products|categories|records_.+)$/);
      if (m) ids.add(m[1]);
    }
    ids.add(DEFAULT_SHOP_ID);
    Object.values(ShopStore.getMap()).forEach(s => ids.add(s.id));

    if (localStorage.getItem("frequentProducts")) localStorage.removeItem("frequentProducts");
    ids.forEach(sid => CleanupService.sweepOrphanDataForShop(sid));
  },

  clearAllAppDataButKeepMigrations() {
    const APP_KEY_PREFIXES = ["shop__", "shop_", "stage_config:", "step_order:", "target:"];
    APP_KEY_PREFIXES.forEach(p => RemoveByPattern(new RegExp(`^${p.replace(/([:*_])/g, "\\$1")}`)));
    RemoveByPattern(/^shop_.*_batches$/);

    ["CFP_auth_token"].forEach(k => localStorage.removeItem(k));
    AuthStore.nukeAuthAndMaps();
    // keep accounts_meta by default
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

    ["CFP_auth_token", ACCOUNTS_KEY, SHOPS_KEY].forEach(k => localStorage.removeItem(k));
    AuthStore.nukeAuthAndMaps();
  },
};
