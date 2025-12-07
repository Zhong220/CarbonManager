// src/utils/storage/categories.store.ts
import { Key } from "./keys";
import { ensureShopId, loadJSON, saveJSON } from "./utils";
import type { Category } from "./types";
import { ProductStore } from "./products.store";

export const CategoryStore = {
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
    const list = ProductStore.load(sid);
    const idx  = list.findIndex(p => p.id === String(pid));
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
    try { return JSON.parse(localStorage.getItem(`shop_${sid}_recent_cat_ids`) || "[]"); } catch { return []; }
  },
  pushRecentId(catId: string | null | undefined, shopId?: string) {
    const sid = ensureShopId(shopId);
    if (!catId) return;
    const cur = CategoryStore.getRecentIds(sid);
    const next = [catId, ...cur.filter(id => id !== catId)].slice(0, 12);
    localStorage.setItem(`shop_${sid}_recent_cat_ids`, JSON.stringify(next));
  },
};
