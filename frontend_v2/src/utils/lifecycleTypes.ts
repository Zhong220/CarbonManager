// 固定階段（不可增刪改名）
export type FixedStageId = "raw" | "manufacture" | "distribution" | "use" | "disposal";

// 既有標籤（你原本的 steps 名稱，如「種子/種苗」「一次加工」…）
export type StepTag = string;

// 使用者自訂步驟：顯示名稱可改，但 tag 必須選一個既有標籤
export type UserStep = {
  id: string;       // uuid
  label: string;    // 顯示給使用者看的名稱（可自訂）
  tag: StepTag;     // 歸類標籤（係數/報表用）
};

// 每個固定 Stage 的設定（步驟由使用者維護）
export type StageConfig = {
  id: FixedStageId;       // 固定
  title: string;          // 固定中文名稱
  allowedTags: StepTag[]; // 此階段允許選用的既有 Tag
  steps: UserStep[];      // 使用者實際建立的步驟（label + tag）
};

// 記錄：顯示用 stepLabel；歸類/計算用 tag；關聯固定 stage 與自訂步驟
export type LifeRecord = {
  id: string;
  productId: string;
  stageId: FixedStageId;
  stepId: string;
  stepLabel: string;
  tag: StepTag;

  material: string;
  amount: number;
  unit: string;
  emission: number;
  timestamp?: number;
  date?: string;
};

// 固定階段模板（第一次載入給預設）
export const FIXED_STAGE_TEMPLATES: StageConfig[] = [
  {
    id: "raw",
    title: "原料取得",
    allowedTags: [
      "種子/種苗", "農藥", "肥料", "其他生產資材",
      "整地", "定植", "栽培管理", "採收",
      "包裝資材", "廢棄物", "能源資源", "運輸",
    ],
    steps: [],
  },
  {
    id: "manufacture",
    title: "製造",
    allowedTags: [
      "冷藏暫存", "一次加工", "半成品暫存",
      "二次加工", "包裝", "出貨",
      "運輸", "廢棄物", "能源資源",
    ],
    steps: [],
  },
  {
    id: "distribution",
    title: "配送銷售",
    allowedTags: ["銷售點", "運輸"],
    steps: [],
  },
  {
    id: "use",
    title: "使用",
    allowedTags: ["消費者使用", "能源資源"],
    steps: [],
  },
  {
    id: "disposal",
    title: "廢棄處理",
    allowedTags: ["回收", "焚化", "掩埋", "能源資源"],
    steps: [],
  },
];
