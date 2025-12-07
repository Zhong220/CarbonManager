// src/utils/storage/keys.ts
export const ACCOUNTS_KEY = "accounts_meta";
export const SHOPS_KEY    = "shops_map";
export const CURR_ACC_KEY = "account";
export const CURR_ROLE_KEY= "role";
export const CURR_SHOP_KEY= "currentShopId";

export const DEFAULT_SHOP_ID = "__default_shop__";

export const MAX_RECENT_CATS = 12;

export const Key = {
  products : (shopId: string) => `shop_${shopId}_products`,
  records  : (shopId: string, pid: string) => `shop_${shopId}_records_${pid}`,
  categories: (shopId: string) => `shop_${shopId}_categories`,
  recentCats: (shopId: string) => `shop_${shopId}_recent_cat_ids`,
  stageCfg  : (shopId: string, productId: string) => `stage_config:${shopId}:${productId}`,
  stepOrder : (shopId: string, productId: string, stageId: string) =>
    `step_order:${shopId}:${productId}:${stageId}`,
  notes: (acc: string) => `notes_${acc}`,
};
