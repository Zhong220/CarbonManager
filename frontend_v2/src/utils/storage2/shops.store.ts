// src/utils/storage/shops.store.ts
import { storage } from "./port";
import { SHOPS_KEY, CURR_SHOP_KEY, DEFAULT_SHOP_ID, Key } from "./keys";
import { uniq, ensureShopId, loadJSON, saveJSON } from "./utils";
import type { TeaShop, AccountMeta, Product, Category } from "./types";
import { AccountStore } from "./accounts.store";
import { AuthStore } from "./auth.store";
import { CleanupService } from "./cleanup.service";

export const ShopStore = {
  getMap(): Record<string, TeaShop> {
    try { return JSON.parse(storage.getItem(SHOPS_KEY) || "{}"); } catch { return {}; }
  },
  saveMap(obj: Record<string, TeaShop>) { storage.setItem(SHOPS_KEY, JSON.stringify(obj)); },

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

    // Remove all data under this shop
    CleanupService.clearShopAllData(shopId);

    // Remove shop from owner meta and adjust currentShopId if needed
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
