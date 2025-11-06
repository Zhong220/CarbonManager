// src/utils/storage/migrations.service.ts
import { storage } from "./port";
import { DEFAULT_SHOP_ID, Key } from "./keys";
import { ensureShopId, loadJSON, saveJSON, uid } from "./utils";
import type { Product } from "./types";
import { AuthStore } from "./auth.store";
import { AccountStore } from "./accounts.store";
import { ShopStore } from "./shops.store";
import { CleanupService } from "./cleanup.service";

export const MigrationService = {
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
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
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
            localStorage.removeItem(oldKey);
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
