// src/utils/lsCleanup.ts
const APP_KEY_PREFIXES = [
  "shop__",           // 例如 shop__<shopId>__products / batches / records_*
  "stage_config:",    // 例如 stage_config:<shopId>:*, 或舊鍵 stage_config:__default_shop__:
  "target:",          // 目標設定/包裝等
];

const APP_GLOBAL_KEYS = [
  "CFP_auth_token",
  "account",
  "current_account",
  "role",
  "currentShopId",
  "shops_map",
  // "accounts_meta" // 依需求：刪帳號時會改寫，而非整個刪掉
];

function removeByPattern(regex: RegExp) {
  const toDel: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (regex.test(k)) toDel.push(k);
  }
  toDel.forEach(k => localStorage.removeItem(k));
}

export function clearAllAppDataButKeepMigrations() {
  // 刪前述 prefix 的所有鍵
  APP_KEY_PREFIXES.forEach(p =>
    removeByPattern(new RegExp(`^${p.replace(/([:*_])/g, "\\$1")}`))
  );
  // 刪全域鍵
  APP_GLOBAL_KEYS.forEach(k => localStorage.removeItem(k));
  // 保留遷移旗標
  // （若你要連遷移旗標也清空，就加上這兩行）
  // localStorage.removeItem("__migrated_multi_shop__");
  // localStorage.removeItem("__migrated_uid_pk__");
}

export function clearShopsData(shopIds: string[]) {
  // 依 shopId 精準刪除所有與該店相關的資料
  shopIds.forEach((shopId) => {
    // 1) 刪 shop__ 前綴
    removeByPattern(new RegExp(`^shop__${shopId.replace(/([:*_])/g, "\\$1")}__`));
    // 2) 刪 stage_config: <shopId>
    removeByPattern(new RegExp(`^stage_config:${shopId.replace(/([:*_])/g, "\\$1")}`));
    // 3) 刪 target: <shopId>
    removeByPattern(new RegExp(`^target:${shopId.replace(/([:*_])/g, "\\$1")}`));
    // 4) 兼容舊的 __default_shop__ 命名（若曾用）
    if (shopId === "__default_shop__") {
      removeByPattern(/^stage_config:__default_shop__:/);
      removeByPattern(/^target:__default_shop__:/);
      removeByPattern(/^shop____default_shop____/);
    }
  });
}

export function deleteAccountCompletely(accountId: string) {
  // 讀 accounts_meta
  const raw = localStorage.getItem("accounts_meta");
  const meta = raw ? JSON.parse(raw) as Record<string, any> : {};
  const acct = meta[accountId];
  const shopIds: string[] = acct?.shopIds ?? [];

  // 1) 刪此帳號所有店鋪資料
  clearShopsData(shopIds);

  // 2) 從 shops_map 移除這些店鋪
  const shopsMapRaw = localStorage.getItem("shops_map");
  const shopsMap = shopsMapRaw ? JSON.parse(shopsMapRaw) as Record<string, any> : {};
  shopIds.forEach(id => delete shopsMap[id]);
  localStorage.setItem("shops_map", JSON.stringify(shopsMap));

  // 3) 從 accounts_meta 移除此帳號
  delete meta[accountId];
  localStorage.setItem("accounts_meta", JSON.stringify(meta));

  // 4) 若刪的是 current_account，清空全域登入狀態
  if (localStorage.getItem("current_account") === accountId) {
    ["CFP_auth_token", "account", "current_account", "role", "currentShopId"].forEach(k =>
      localStorage.removeItem(k)
    );
  }
}

/** 極端方式：整個 App 重置（不影響同網域其它站的資料） */
export function hardAppReset() {
  // 只清本 App 的鍵，避免清到你瀏覽器的其他站資料
  clearAllAppDataButKeepMigrations();
}
