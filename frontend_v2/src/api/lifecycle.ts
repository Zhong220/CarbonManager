// src/api/lifecycle.ts
// 前端 request for Product Life (依 ERM 設計)
// 依你現有的 http helper（帶 JWT、baseURL、錯誤處理）

import { http } from "./http";

/* ---------- 基本型別（對應 ERM） ---------- */

// 預設的階段（emission_stages）
export interface StageDTO {
  id: number;
  name: string;
  // 預留：order、active...（若後端未提供，不會影響）
  order_id?: number | null;
  is_active?: boolean | null;
}

// 階段內的預設步驟（steps_map）
export interface StepDTO {
  id: number;
  stage_id: number;
  /** 你前端使用的 tag（輸入紀錄時會帶這個） */
  tag: string; // e.g. "material", "process", "transport"
  /** 供 UI 顯示的名稱 */
  name: string;
  is_active?: boolean | null;
}

// 係數（factors）
export interface FactorDTO {
  id: number;
  name: string;     // 係數名稱（材料/動作）
  unit: string | null; // 係數單位（與 amount 對應）
  category?: string | null;
  source?: string | null;
  value_per_unit?: number | null; // = coefficient（kgCO2e / unit）
  image_count?: number | null;    // 你 ERM 有放，先保留
}

// 單筆排放紀錄（emissions）
export interface EmissionDTO {
  id: number;
  product_id: number;
  stage_id: number;
  /** 前端會用的步驟 tag（對應 steps_map.name / tag），用來抓 factors */
  step_tag: string; // e.g. "material", "transport", ...
  /** 係數名（或自填） */
  material: string;
  /** 用量（amount * factor.value_per_unit = emission_amount） */
  amount: number;
  unit: string | null;
  /** 計算後的排放（kgCO2e） */
  emission_amount: number;

  // 交通/運輸相關欄位（ERMs 有，先放可選）
  transport_origin?: string | null;
  transport_dest?: string | null;
  transport_mode?: string | null;
  distance_km?: number | null;

  // 時間欄位
  timestamp?: number | null; // 秒
  date?: string | null;      // ISO string

  // 其他（備註、圖片）
  note?: string | null;
  image_count?: number | null;

  created_at?: string;
  updated_at?: string;
}

/* ---------- 生產歷程頁面會用到的 API ---------- */

/** 1) 讀取預設「階段」清單（emission_stages） */
export async function apiListStages(): Promise<StageDTO[]> {
  // GET /emission_stages
  // 回傳格式可容錯：[{...}] 或 {stages:[...]}
  const res = await http.get<any>("/emission_stages");
  if (Array.isArray(res)) return res as StageDTO[];
  if (Array.isArray(res?.stages)) return res.stages as StageDTO[];
  return [];
}

/** 2) 讀取某階段的預設「步驟」清單（steps_map） */
export async function apiListSteps(stageId: number): Promise<StepDTO[]> {
  // GET /emission_stages/:id/steps  或  /steps?stage_id=xxx
  // 兩種都兼容一下
  try {
    const res = await http.get<any>(`/emission_stages/${stageId}/steps`);
    if (Array.isArray(res)) return res as StepDTO[];
    if (Array.isArray(res?.steps)) return res.steps as StepDTO[];
    return [];
  } catch {
    const res = await http.get<any>("/steps", { stage_id: stageId });
    if (Array.isArray(res)) return res as StepDTO[];
    if (Array.isArray(res?.steps)) return res.steps as StepDTO[];
    return [];
  }
}

/** 3) 依步驟 tag 查係數（factors） */
export async function apiListFactorsByTag(params: {
  step_tag: string;   // e.g. "material" | "transport" | ...
  q?: string;         // 關鍵字（名稱模糊查）
  unit?: string;      // 限定單位
  limit?: number;     // 取前 N 筆
}): Promise<FactorDTO[]> {
  // GET /factors?step_tag=material&q=...&unit=...&limit=...
  const res = await http.get<any>("/factors", params as any);
  if (Array.isArray(res)) return res as FactorDTO[];
  if (Array.isArray(res?.factors)) return res.factors as FactorDTO[];
  if (Array.isArray(res?.data)) return res.data as FactorDTO[];
  return [];
}

/** 4) 讀取某產品的所有排放紀錄（emissions） */
export async function apiListEmissions(productId: number, options?: {
  since_ts?: number;   // 從某個 timestamp 之後
  until_ts?: number;   // 到某個 timestamp 以前
  stage_id?: number;   // 過濾某個階段
  step_tag?: string;   // 過濾某個步驟 tag
}): Promise<EmissionDTO[]> {
  // GET /products/:id/emissions
  const res = await http.get<any>(`/products/${productId}/emissions`, options as any);
  if (Array.isArray(res)) return res as EmissionDTO[];
  if (Array.isArray(res?.emissions)) return res.emissions as EmissionDTO[];
  if (Array.isArray(res?.data)) return res.data as EmissionDTO[];
  return [];
}

/** 5) 新增排放紀錄（Create emission） */
export async function apiCreateEmission(productId: number, payload: {
  stage_id: number;
  step_tag: string;
  material: string;
  amount: number;
  unit?: string | null;
  emission_amount: number;

  transport_origin?: string | null;
  transport_dest?: string | null;
  transport_mode?: string | null;
  distance_km?: number | null;

  timestamp?: number | null;
  date?: string | null;
  note?: string | null;
}): Promise<{ id: number }> {
  // POST /products/:id/emissions
  const body = { ...payload, unit: payload.unit ?? null };
  const res = await http.post<any>(`/products/${productId}/emissions`, body);
  // 後端可能回 {id} 或 {emission:{id,...}}
  const id =
    Number(res?.id) ||
    Number(res?.emission?.id);
  return { id };
}

/** 6) 更新排放紀錄（Update emission） */
export async function apiUpdateEmission(emissionId: number, patch: Partial<{
  stage_id: number;
  step_tag: string;
  material: string;
  amount: number;
  unit: string | null;
  emission_amount: number;

  transport_origin: string | null;
  transport_dest: string | null;
  transport_mode: string | null;
  distance_km: number | null;

  timestamp: number | null;
  date: string | null;
  note: string | null;
}>): Promise<void> {
  // PUT /emissions/:id
  await http.put(`/emissions/${emissionId}`, patch);
}

/** 7) 刪除排放紀錄（Delete emission） */
export async function apiDeleteEmission(emissionId: number): Promise<void> {
  // DELETE /emissions/:id
  await http.delete(`/emissions/${emissionId}`);
}

/** 8) 產品統計摘要（依階段/步驟/係數彙總） */
export interface ProductSummary {
  grand_total: number; // 全部排放總和
  by_stage: Array<{
    stage_id: number;
    stage_name: string;
    total: number;
    steps: Array<{ step_tag: string; step_name: string; total: number }>;
  }>;
  by_material: Array<{ label: string; total: number }>;
}

export async function apiGetProductSummary(productId: number, options?: {
  since_ts?: number;
  until_ts?: number;
}): Promise<ProductSummary> {
  // GET /products/:id/emissions/summary
  const res = await http.get<any>(`/products/${productId}/emissions/summary`, options as any);
  // 後端結構可能不同，這裡做個最小容錯
  return {
    grand_total: Number(res?.grand_total ?? 0),
    by_stage: Array.isArray(res?.by_stage) ? res.by_stage : [],
    by_material: Array.isArray(res?.by_material) ? res.by_material : [],
  };
}
