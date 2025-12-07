// ====================================================================
// src/api/lifecycle.ts
// ====================================================================
// Strict to provided backend API (no guessing endpoints):
// - Product Steps:
//    GET  /api/products/:productId/steps/:stageId
//    POST /api/products/:productId/steps
// - Product Emissions:
//    GET  /api/products/:productId/emissions
//    POST /api/products/:productId/emissions
//    GET  /api/products/:productId/emissions/summary
// - Emissions:
//    GET    /api/emissions
//    GET    /api/emissions/:emissionId
//    PUT    /api/emissions/:emissionId
//    DELETE /api/emissions/:emissionId
// - Factors:
//    GET /api/factors
//
// NOTE: 後端未公開 /api/stages 時：
//   1) 先讀 localStorage 覆蓋（lifecycle:stageMap，可放 {raw:'raw',...} 或 legacy 數字版 map）
//   2) 嘗試從 /summary 推斷
//   3) 最後回固定字串對照 {raw:'raw', ...}
// ====================================================================

import { http } from "./http";

/* ================= types ================= */
export type StageKey =
  | "raw"
  | "manufacture"
  | "distribution"
  | "use"
  | "disposal";

export type StageId = StageKey;

export interface StageDTO {
  id: StageId;
  name: string;
  order_id?: number | null;
  is_active?: boolean | null;
  code?: string | null;
  slug?: string | null;
}
export type StageRow = StageDTO;

export interface StepDTO {
  id: number | string; // ★ 支援 "STP1" 這種字串
  stage_id: StageId;
  tag?: string | null;
  tag_id?: string | null; // 後端目前回 "TAG3" 類型
  name: string;
  is_active?: boolean | null;
  sort_order?: number | null;
}

export interface FactorDTO {
  id: number;
  name: string;
  unit: string | null;
  category?: string | null;
  midcategory?: string | null;
  subcategory?: string | null;
  announcementyear?: string | null;
  value_per_unit?: number | null;
}

export interface EmissionDTO {
  id: number;
  product_id: number;
  name: string;
  stage_id: StageId | null; // ★ 字串
  factor_id: number | null;
  tag_id: number | null;
  step_id: number | null;
  quantity: number | null; // = amount
  step_tag?: string | null;

  // 常見對等欄位（後端可能回其中之一）
  emission_amount?: number | null;
  total_emission?: number | null;
  emission?: number | null;

  // 從 DB 其他欄位/或 join factor 得來的單位來源（只讀）
  transport_unit?: string | null;
  fuel_input_unit?: string | null;
  factor_unit?: string | null;

  created_by?: number | null;
  created_at?: string;
  updated_at?: string;
}

/* ================= helpers ================= */
function pickList(res: any, key: string): any[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;

  if (Array.isArray(res[key])) return res[key];
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.items)) return res.items;
  if (Array.isArray(res.results)) return res.results;
  if (Array.isArray(res.rows)) return res.rows;
  if (res.data && Array.isArray(res.data.items)) return res.data.items;

  return [];
}

function is404(err: any) {
  const m = String(err?.message || err);
  return /(^|\s)HTTP\s+404\b/i.test(m) || /not\s*found/i.test(m);
}
function is409(err: any) {
  const m = String(err?.message || err);
  return /(^|\s)HTTP\s+409\b/i.test(m) || /conflict/i.test(m);
}

/* ================= offline queue (opt-in) ================= */
const LS_UNSYNC_KEY = "unsynced_emissions_v1";
type UnsyncedItem = {
  _ts: number;
  productId: string | number; // ★ 允許 PRD1 或數字
  payload: CreateEmissionPayload;
};

function readUnsynced(): UnsyncedItem[] {
  try {
    return JSON.parse(localStorage.getItem(LS_UNSYNC_KEY) || "[]");
  } catch {
    return [];
  }
}
function writeUnsynced(list: UnsyncedItem[]) {
  localStorage.setItem(LS_UNSYNC_KEY, JSON.stringify(list));
}
function enqueueUnsynced(
  productId: string | number,
  payload: CreateEmissionPayload
) {
  const list = readUnsynced();
  list.push({ _ts: Date.now(), productId, payload });
  writeUnsynced(list);
}
export async function syncUnsyncedEmissions() {
  const list = readUnsynced();
  if (!list.length) return { synced: 0, remain: 0 };
  const remain: UnsyncedItem[] = [];
  let ok = 0;
  for (const it of list) {
    try {
      await _postUnderProduct(it.productId, it.payload);
      ok++;
    } catch {
      remain.push(it);
    }
  }
  writeUnsynced(remain);
  return { synced: ok, remain: remain.length };
}
export function getUnsyncedCount() {
  return readUnsynced().length;
}

/* ================= Stage Resolver（支援舊數字 cache） ================= */
type StageMap = Record<StageKey, StageId>;
type Cached<T> = { at: number; data: T };

const STAGE_CACHE_KEY = "lifecycle:stageMap";
const STAGE_CACHE_TTL = 1000 * 60 * 60 * 12; // 12h
const DEFAULT_STAGE_MAP: StageMap = {
  raw: "raw",
  manufacture: "manufacture",
  distribution: "distribution",
  use: "use",
  disposal: "disposal",
};
const ENABLE_BACKEND_STAGES_PROBE = false;

function normalizeStageMap(src: any): StageMap | null {
  if (!src || typeof src !== "object") return null;
  const keys: StageKey[] = [
    "raw",
    "manufacture",
    "distribution",
    "use",
    "disposal",
  ];
  const out: Partial<StageMap> = {};
  for (const k of keys) {
    let v = (src as any)[k];
    if (v == null) return null;

    if (typeof v === "number") {
      switch (v) {
        case 1:
          v = "raw";
          break;
        case 2:
          v = "manufacture";
          break;
        case 3:
          v = "distribution";
          break;
        case 4:
          v = "use";
          break;
        case 5:
          v = "disposal";
          break;
        default:
          return null;
      }
    }
    (out as any)[k] = String(v) as StageId;
  }
  return out as StageMap;
}

function readStageCache(): StageMap | null {
  try {
    const raw = localStorage.getItem(STAGE_CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);

    const isPlain =
      obj &&
      typeof obj === "object" &&
      "raw" in obj &&
      "manufacture" in obj &&
      "distribution" in obj &&
      "use" in obj &&
      "disposal" in obj;

    if (isPlain) {
      const m = normalizeStageMap(obj);
      if (!m) return null;
      return m;
    }

    const c: Cached<any> = obj;
    if (!c?.data) return null;
    if (Date.now() - (c.at || 0) > STAGE_CACHE_TTL) return null;

    const m = normalizeStageMap(c.data);
    if (!m) return null;
    return m;
  } catch {
    return null;
  }
}
function writeStageCache(data: StageMap) {
  localStorage.setItem(
    STAGE_CACHE_KEY,
    JSON.stringify({ at: Date.now(), data })
  );
}

export function overrideStageMapForDev(
  mapLike: Partial<Record<StageKey, string | number>>
) {
  const m = normalizeStageMap(mapLike as any);
  if (m) writeStageCache(m);
}

async function tryFetchStages(): Promise<StageRow[] | null> {
  if (!ENABLE_BACKEND_STAGES_PROBE) return null;
  try {
    const res = await http.get<any>("/api/stages");
    const list = pickList(res, "stages") as StageRow[];
    return list?.length ? list : null;
  } catch (e) {
    if (is404(e)) return null;
    throw e;
  }
}

async function tryInferStagesFromSummary(
  productId: string | number
): Promise<StageRow[] | null> {
  try {
    // 🔧 Hotfix: 後端 /emissions/summary 期待的是 "PD" 前綴
    const rawId = String(productId);
    const summaryId = rawId.startsWith("PRD") ? `PD${rawId.slice(3)}` : rawId;

    const res = await http.get<any>(
      `/api/products/${encodeURIComponent(String(summaryId))}/emissions/summary`
    );

    if (Array.isArray(res?.stages) && res.stages.length) {
      return res.stages.map((x: any) => ({
        id: String(x.id ?? x.stage_id ?? x.code ?? "").toLowerCase() as StageId,
        code: String(x.code ?? x.id ?? "").toLowerCase(),
        name: String(x.name ?? ""),
      }));
    }

    if (Array.isArray(res?.by_stage) && res.by_stage.length) {
      return res.by_stage.map((x: any) => ({
        id: String(x.stage_id ?? x.id ?? x.code ?? "").toLowerCase() as StageId,
        code: String(x.code ?? x.stage_id ?? "").toLowerCase(),
        name: String(x.name ?? ""),
      }));
    }

    const keys: StageKey[] = [
      "raw",
      "manufacture",
      "distribution",
      "use",
      "disposal",
    ];
    if (keys.some((k) => res?.[k])) {
      const rows: StageRow[] = [];
      for (const k of keys) {
        const v = (res as any)[k];
        if (!v) continue;
        const id = String(v?.stage_id ?? v?.id ?? k).toLowerCase() as StageId;
        rows.push({
          id,
          name: v?.name ?? k,
          code: k,
          order_id: keys.indexOf(k) + 1,
        });
      }
      return rows.length ? rows : null;
    }
    return null;
  } catch (e) {
    // ❗ 無論 404 或 500，都只視為「沒辦法從 summary 推斷」，不要讓整個流程炸掉
    if (!is404(e)) {
      console.warn("[lifecycle] tryInferStagesFromSummary failed", e);
    }
    return null;
  }
}

function toStageMap(rows: StageRow[]): StageMap | null {
  if (!rows?.length) return null;
  const take = (pred: (r: StageRow) => boolean) =>
    rows.find(pred)?.id as StageId | undefined;

  const findByKey = (key: StageKey) =>
    take((r) => (r.code ?? r.slug ?? "").toLowerCase() === key) ??
    take((r) => (r.id ?? "").toLowerCase() === key) ??
    (key === "raw"
      ? take((r) => /(raw|原料|種植)/i.test(`${r.name}${r.code}${r.slug}`))
      : undefined) ??
    (key === "manufacture"
      ? take((r) =>
          /(manuf|加[工製]|製造)/i.test(`${r.name}${r.code}${r.slug}`)
        )
      : undefined) ??
    (key === "distribution"
      ? take((r) => /(dist|運輸|配送)/i.test(`${r.name}${r.code}${r.slug}`))
      : undefined) ??
    (key === "use"
      ? take((r) => /(use|使用)/i.test(`${r.name}${r.code}${r.slug}`))
      : undefined) ??
    (key === "disposal"
      ? take((r) =>
          /(dispos|廢棄|處置|回收)/i.test(`${r.name}${r.code}${r.slug}`)
        )
      : undefined);

  const map: Partial<StageMap> = {};
  (
    ["raw", "manufacture", "distribution", "use", "disposal"] as StageKey[]
  ).forEach((k) => {
    const id = findByKey(k);
    if (id) (map as any)[k] = id;
  });
  return Object.keys(map).length === 5 ? (map as StageMap) : null;
}

export async function getStageMap(
  productId?: string | number
): Promise<StageMap> {
  const cached = readStageCache();
  if (cached) return cached;

  const rows2 = await tryFetchStages();
  if (rows2?.length) {
    const map = toStageMap(rows2);
    if (map) {
      writeStageCache(map);
      return map;
    }
  }

  if (productId != null) {
    const rows3 = await tryInferStagesFromSummary(productId);
    if (rows3?.length) {
      const map = toStageMap(rows3);
      if (map) {
        writeStageCache(map);
        return map;
      }
    }
  }

  writeStageCache(DEFAULT_STAGE_MAP);
  return DEFAULT_STAGE_MAP;
}

export async function apiListStages(
  productId?: string | number
): Promise<StageRow[]> {
  const rows = await tryFetchStages();
  if (rows?.length) return rows;
  const map = await getStageMap(productId);
  const keys: StageKey[] = [
    "raw",
    "manufacture",
    "distribution",
    "use",
    "disposal",
  ];
  return keys.map((k, i) => ({
    id: map[k],
    name: (
      {
        raw: "原料/種植",
        manufacture: "加工/製造",
        distribution: "運輸/配送",
        use: "使用",
        disposal: "廢棄/回收",
      } as Record<StageKey, string>
    )[k],
    order_id: i + 1,
    is_active: true,
    code: k,
    slug: k,
  }));
}

/* ================= Steps ================= */

/** 後端 /products/:id/steps 的 payload 形狀 */
export interface CreateStepPayload {
  stage_id: StageId;
  tag_id: string | number; // ★ 可傳 3 或 "TAG3"
  name: string;
  sort_order: number;
}

export async function apiListStepsByStage(
  stageId: StageId,
  opts: { productId: string | number } // ★ 允許 PRD1
): Promise<StepDTO[]> {
  const { productId } = opts;
  try {
    const res = await http.get<any>(
      `/api/products/${encodeURIComponent(
        String(productId)
      )}/steps/${encodeURIComponent(stageId)}`
    );

    const rawList = pickList(res, "steps") as any[];

    const list: StepDTO[] = (rawList || []).map((raw) => ({
      // 後端給的是 step_id / step_name / tag_id / sort_order
      id: raw.step_id ?? raw.id ?? `${stageId}-${raw.step_name ?? ""}`,
      stage_id: stageId,
      tag_id: raw.tag_id ?? null, // e.g. "TAG3"
      name: raw.step_name ?? raw.name ?? "",
      sort_order: typeof raw.sort_order === "number" ? raw.sort_order : null,
    }));

    return list;
  } catch (e) {
    if (is404(e)) return [];
    throw e;
  }
}

/**
 * 建立單一步驟（符合後端 /api/products/:productId/steps）
 */
export async function apiCreateStep(
  productId: string | number,
  payload: CreateStepPayload
): Promise<void> {
  // 後端 parse_display_id(..., "TAG") 期待的是 "TAG3" 這種字串
  let tag_id: string | number = payload.tag_id;

  if (typeof tag_id === "number") {
    tag_id = `TAG${tag_id}`;
  }

  const body = {
    stage_id: payload.stage_id,
    tag_id,
    name: payload.name,
    sort_order: payload.sort_order,
  };
  await http.post(
    `/api/products/${encodeURIComponent(String(productId))}/steps`,
    body
  );
}

/**
 * 兼容舊呼叫：傳進一整個 steps 陣列，
 * 內部改成「有 tag_id 的步驟才一筆一筆呼叫 apiCreateStep」。
 * 若沒有任何步驟帶 tag_id，會直接略過，不再打到後端。
 */
export async function apiSaveStepOrder(
  productId: string | number,
  stageId: StageId,
  steps: Array<Partial<StepDTO>>
): Promise<void> {
  if (!steps?.length) {
    console.info("[apiSaveStepOrder] 沒有任何步驟，略過呼叫後端");
    return;
  }

  const normalized: CreateStepPayload[] = [];
  steps.forEach((s, idx) => {
    const any = s as any;

    const rawTag = any.tag_id;
    if (rawTag == null) {
      console.warn("[apiSaveStepOrder] 此步驟沒有 tag_id，略過同步", any);
      return;
    }

    // 支援 number 或 "TAG3"
    const tagIdDisplay = typeof rawTag === "string" ? rawTag : `TAG${rawTag}`;

    const stage_id: StageId = (any.stage_id as StageId) || stageId;
    const name: string = String(any.name ?? any.label ?? "");
    const sort_order: number =
      typeof any.sort_order === "number" && isFinite(any.sort_order)
        ? any.sort_order
        : idx + 1;

    normalized.push({ stage_id, tag_id: tagIdDisplay, name, sort_order });
  });

  if (!normalized.length) {
    console.info(
      "[apiSaveStepOrder] 沒有任何帶 tag_id 的步驟可同步，略過呼叫後端"
    );
    return;
  }

  for (const st of normalized) {
    try {
      await apiCreateStep(productId, st);
    } catch (e) {
      console.error("[apiSaveStepOrder] 同步單一步驟失敗", st, e);
    }
  }
}

/* ================= Factors ================= */
export interface FactorSearchParams {
  q?: string;
  category?: string;
  midcategory?: string;
  subcategory?: string;
  unit?: string;
  limit?: number;
  offset?: number;
}

// 共用 mapping：原始 row -> FactorDTO
function mapRawFactor(raw: any): FactorDTO {
  const value =
    raw.value_per_unit ??
    raw.coefficient ??
    raw.value ??
    (typeof raw.coe === "number" ? raw.coe : null);

  const unit = raw.unit ?? raw.unit_name ?? null;

  return {
    id: Number(raw.id),
    name: String(raw.name ?? ""),
    unit,
    category: raw.category ?? null,
    midcategory: raw.midcategory ?? null,
    subcategory: raw.subcategory ?? null,
    announcementyear: raw.announcementyear ?? null,
    value_per_unit: value != null ? Number(value) : null,
  };
}

export async function apiSearchFactors(
  params: FactorSearchParams
): Promise<FactorDTO[]> {
  const res = await http.get<any>("/api/factors", params as any);
  const list = pickList(res, "factors");
  return (list || []).map(mapRawFactor);
}

/** 更強韌：先試 step_tag，再退成 q=tag，最後寬查一批 */
export async function apiListFactorsByTag(params: {
  step_tag: string;
  q?: string;
  unit?: string;
  limit?: number;
}): Promise<FactorDTO[]> {
  const { step_tag, unit, limit = 50 } = params;

  // A. 直接用 step_tag（若後端支援）
  try {
    const resA = await http.get<any>("/api/factors", {
      step_tag,
      unit: unit ?? undefined,
      limit,
    });
    const listA = pickList(resA, "factors");
    if (Array.isArray(listA) && listA.length) {
      return (listA as any[]).map(mapRawFactor);
    }
  } catch (e) {
    if (!is404(e)) {
      console.warn("[factors] step_tag 查詢失敗，改用關鍵字回退", e);
    }
  }

  // B. 退成 q=tag
  try {
    const listB = await apiSearchFactors({ q: step_tag, unit, limit });
    if (listB.length) return listB;
  } catch (e) {
    console.warn("[factors] q=tag 回退失敗，改用寬查", e);
  }

  // C. 最後寬查一批（避免下拉完全空）
  try {
    return await apiSearchFactors({ limit, unit });
  } catch {
    return [];
  }
}

/* ================= Emissions ================= */
function productEmissionBase(productId: string | number) {
  return `/api/products/${encodeURIComponent(String(productId))}/emissions`;
}

export async function apiListEmissionsByProduct(
  productId: string | number
): Promise<EmissionDTO[]> {
  
  const raw = String(productId);
  const m = raw.match(/(\d+)$/);
  const pidForList = m ? m[1] : raw;

  try {
    const res = await http.get<any>(
      `/api/products/${encodeURIComponent(pidForList)}/emissions`
    );
    const list = pickList(res, "emissions");
    console.log("[apiListEmissionsByProduct] fetched", {
      productId,
      pidForList,
      count: Array.isArray(list) ? list.length : "n/a",
    });
    return (list || []) as EmissionDTO[];
  } catch (e) {
    if (is404(e)) {
      console.info(
        `[apiListEmissionsByProduct] product ${productId} 尚無排放紀錄，回傳空陣列`
      );
      return [];
    }
    throw e;
  }
}

/* 建立 emission 的 payload */
export interface CreateEmissionPayload {
  fixedStage?: StageKey; // 推薦用這個，由本檔轉 stage_id（字串）
  stage_id?: StageId | number;

  step_tag?: string | null;
  material?: string | null;
  amount?: number | null;
  // unit?: string | null;   // ⚠️ DB 無一般 unit 欄位，不要送
  emission_amount?: number | null;
  timestamp?: number | null;
  date?: string | null;
  note?: string | null;

  name?: string | null;
  factor_id?: number | null;
  tag_id?: string | number | null; // ★ 支援 "TAG3" 或 3
  step_id?: string | number | null; // ★ 支援 "STP1" 或 1
  quantity?: number | null;

  client_ref?: string | null;
}

export async function apiCreateEmission(
  productId: string | number,
  payload: CreateEmissionPayload
): Promise<void> {
  try {
    await _postUnderProduct(productId, payload);
  } catch (err) {
    if (is404(err)) {
      enqueueUnsynced(productId, payload);
      console.warn("[emissions] 404; saved locally for later sync.");
      return;
    }
    if (is409(err)) {
      throw err;
    }
    throw err;
  }
}

export async function apiGetEmission(emissionId: number): Promise<EmissionDTO> {
  const res = await http.get<any>(`/api/emissions/${emissionId}`);
  return res as EmissionDTO;
}

/** 兼容：可傳「數字」或「物件 patch」更新 */
export async function apiUpdateEmissionQuantity(
  emissionId: number,
  patch: unknown
): Promise<void> {
  if (typeof patch === "number" || typeof patch === "string") {
    const num = normalizeToNumber(patch);
    if (num == null || !isFinite(num)) {
      throw new Error(
        `INVALID_AMOUNT: new_amount 需要是數字，收到 ${JSON.stringify(patch)}`
      );
    }
    await http.put(`/api/emissions/${emissionId}`, { new_amount: num });
    return;
  }

  if (patch && typeof patch === "object") {
    const obj = patch as any;

    const amountNum = normalizeToNumber(
      obj.new_amount ?? obj.quantity ?? obj.amount ?? obj.newAmount
    );
    const emissionNum = normalizeToNumber(
      obj.new_emission_amount ??
        obj.new_total_emission ??
        obj.total_emission ??
        obj.emission_amount ??
        obj.emission
    );

    const body: any = {};
    if (amountNum != null && isFinite(amountNum)) {
      body.new_amount = amountNum;
      body.quantity = amountNum;
    }
    if (emissionNum != null && isFinite(emissionNum)) {
      body.new_emission_amount = emissionNum;
      body.new_total_emission = emissionNum;
      body.emission_amount = emissionNum;
      body.total_emission = emissionNum;
      body.emission = emissionNum;
    }

    if (!("new_amount" in body) && !("new_emission_amount" in body)) {
      throw new Error(
        "INVALID_PATCH: 至少需要提供 new_amount/quantity 或 new_emission_amount/total_emission/emission_amount"
      );
    }

    await http.put(`/api/emissions/${emissionId}`, body);
    return;
  }

  throw new Error(
    `INVALID_PATCH_TYPE: 不支援的更新型別 ${typeof patch}（需 number 或 object）`
  );
}

export async function apiDeleteEmission(emissionId: number): Promise<void> {
  await http.delete(`/api/emissions/${emissionId}`);
}

/* ================= Summary ================= */
export type ProductSummaryDTO = any;
export async function apiGetProductSummary(
  productId: string | number
): Promise<ProductSummaryDTO> {
  // 🔧 Hotfix：summary endpoint 需要 "PD" 前綴，不能直接丟 PRD*
  const rawId = String(productId);
  const summaryId = rawId.startsWith("PRD") ? `PD${rawId.slice(3)}` : rawId;

  return await http.get<any>(
    `/api/products/${encodeURIComponent(String(summaryId))}/emissions/summary`
  );
}

/* ================= internals ================= */
async function _postUnderProduct(
  productId: string | number,
  payload: CreateEmissionPayload
) {
  const unified = await normalizeCreatePayload(productId, payload);
  return await http.post(`${productEmissionBase(productId)}`, unified);
}

function numToStageId(n: number): StageId | null {
  switch (n) {
    case 1:
      return "raw";
    case 2:
      return "manufacture";
    case 3:
      return "distribution";
    case 4:
      return "use";
    case 5:
      return "disposal";
    default:
      return null;
  }
}

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  for (const k of Object.keys(obj)) {
    const v = (obj as any)[k];
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

async function normalizeCreatePayload(
  productId: string | number,
  p: CreateEmissionPayload
) {
  let stage_id: StageId | null = null;

  if (p.stage_id !== undefined && p.stage_id !== null) {
    if (typeof p.stage_id === "number") {
      stage_id = numToStageId(p.stage_id);
    } else {
      stage_id = p.stage_id as StageId;
    }
  } else if (p.fixedStage) {
    const map = await getStageMap(productId);
    stage_id = map[p.fixedStage];
  }

  if (!stage_id) {
    const err: any = new Error(
      `stage_id 無效。請傳 fixedStage（raw/manufacture/distribution/use/disposal）或傳 stage_id='raw' 等字串。
如需手動覆蓋，可在 Console 設定：
localStorage.setItem('lifecycle:stageMap', JSON.stringify({ raw:'raw', manufacture:'manufacture', distribution:'distribution', use:'use', disposal:'disposal' }))`
    );
    err.name = "STAGE_ID_MISSING";
    throw err;
  }

  const name = (p.material ?? p.name ?? "").toString();

  const quantity =
    typeof p.amount === "number" && isFinite(p.amount)
      ? p.amount
      : typeof p.quantity === "number" && isFinite(p.quantity)
      ? p.quantity
      : null;

  const total_emission =
    typeof p.emission_amount === "number" && isFinite(p.emission_amount)
      ? p.emission_amount
      : null;

  const base: any = {
    product_id: productId,
    stage_id,
    quantity,
    name,
    step_tag: p.step_tag ?? null,
    material: p.material ?? null,
    amount: p.amount ?? null,
    emission_amount: p.emission_amount ?? null,
    timestamp: p.timestamp ?? null,
    date: p.date ?? null,
    note: p.note ?? null,
    client_ref:
      p.client_ref ??
      `fe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };

  // ---------- 關鍵修改：保證 tag_id / step_id 一定是合法字串，不會是 null ----------
  // factor_id：照舊，有給就帶
  const rawFactorId = (p as any).factor_id;
  if (rawFactorId !== undefined) {
    base.factor_id = rawFactorId;
  }

  // tag_id：如果沒給，就用預設 "TAG1"
  let rawTagId = (p as any).tag_id;
  if (rawTagId == null) {
    // 之後可以改成根據 step_tag 做 mapping
    rawTagId = "TAG1";
  } else if (typeof rawTagId === "number") {
    rawTagId = `TAG${rawTagId}`;
  }
  base.tag_id = rawTagId;

  // step_id：如果沒給，就用預設 "STP1"
  let rawStepId = (p as any).step_id;
  if (rawStepId == null) {
    rawStepId = "STP1";
  } else if (typeof rawStepId === "number") {
    rawStepId = `STP${rawStepId}`;
  }
  base.step_id = rawStepId;
  // ---------------------------------------------------------------------

  if (quantity != null && base.new_amount == null) base.new_amount = quantity;
  if (total_emission != null) {
    if (base.total_emission == null) base.total_emission = total_emission;
    if (base.emission == null) base.emission = total_emission;
  }

  return stripUndefined(base);
}

/* ================ local utils ================ */
function normalizeToNumber(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  if (v && typeof v === "object") {
    const o = v as any;
    const cands = [
      o.amount,
      o.quantity,
      o.value,
      o.val,
      o.new_amount,
      o.newAmount,
      o?.value?.amount,
      o?.value?.quantity,
      o?.value?.value,
    ];
    for (const c of cands) {
      const n =
        typeof c === "number"
          ? c
          : typeof c === "string"
          ? Number(c.trim())
          : null;
      if (n != null && Number.isFinite(n)) return n;
    }
    return null;
  }
  return null;
}
