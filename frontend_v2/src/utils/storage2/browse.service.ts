// src/utils/storage/browse.service.ts
import { Key, DEFAULT_SHOP_ID } from "./keys";
import { loadJSON } from "./utils";
import type { TeaShop, Product, Category } from "./types";
import { ShopStore } from "./shops.store";

export const BrowseService = {
  listBrowsableShops(): TeaShop[] {
    const map = ShopStore.getMap();
    const registered = Object.values(map);

    const hasDataForShop = (sid: string) => {
      const prods = loadJSON<Product[]>(Key.products(sid), []);
      const cats  = loadJSON<Category[]>(Key.categories(sid), []);
      const anyRecord = Object.keys(localStorage).some(k => k.startsWith(`shop_${sid}_records_`));
      const anyStage  = Object.keys(localStorage).some(k => k.startsWith(`stage_config:${sid}:`));
      const anyOrder  = Object.keys(localStorage).some(k => k.startsWith(`step_order:${sid}:`));
      return prods.length > 0 || cats.length > 0 || anyRecord || anyStage || anyOrder;
    };

    const inferred: TeaShop[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
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
