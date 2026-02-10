// src/utils/stageOps.ts
import {
  loadStageConfig,
  saveStageConfig,
  loadRecords,
  saveRecords,
  getCurrentShopIdSafe,
} from "@/utils/storage";
import { StageConfig, FixedStageId } from "@/utils/lifecycleTypes";

/** 安全比對：同時支援舊資料(用文字)與新資料(用id) */
function recordMatchStep(
  rec: any,
  stageId: string,
  stepId?: string,
  stepLabel?: string
) {
  const stageOk = rec.stageId ? rec.stageId === stageId : rec.stage === stageId;
  if (!stageOk) return false;

  // 盡量用 stepId，比不到再比 label
  if (stepId && (rec.stepId ? rec.stepId === stepId : false)) return true;
  if (stepLabel) return rec.step === stepLabel || rec.stepLabel === stepLabel;
  return false;
}

/**
 * 計算某 step 影響的歷史筆數
 *
 * ⚠️ 新版 storage 需要 productId / shopId，所以這裡多一個 opts：
 *    - 如果沒有傳 productId，就直接回傳 0（不去讀任何紀錄）
 */
export function countRecordsForStep(
  stageId: string,
  stepId?: string,
  stepLabel?: string,
  opts?: { productId?: string | number; shopId?: string }
): number {
  const pid = opts?.productId;
  const sid = opts?.shopId ?? getCurrentShopIdSafe();

  if (!pid) {
    // 沒有 productId 的情況下無法讀紀錄，就直接回 0
    return 0;
  }

  const records = loadRecords(pid, sid) as any[];
  return records.filter((r) => recordMatchStep(r, stageId, stepId, stepLabel))
    .length;
}

/**
 * 重新命名 step（只改 StageConfig；歷史紀錄保留原本內容）
 *
 * ⚠️ 需要 productId / shopId（從 opts 傳入）
 */
export function renameStep(
  stageId: FixedStageId,
  stepId: string,
  newLabel: string,
  opts?: { productId?: string | number; shopId?: string }
) {
  const pid = opts?.productId;
  const sid = opts?.shopId ?? getCurrentShopIdSafe();

  if (!pid) {
    // 沒有 productId 時無法定位個別商品的 StageConfig，直接略過
    console.warn("[stageOps.renameStep] missing productId, skip");
    return;
  }

  const pidStr = String(pid);
  const cfg = (loadStageConfig(sid, pidStr) || []) as StageConfig[];

  const stage = cfg.find((s) => s.id === stageId);
  if (!stage) return;

  const target = stage.steps.find((s) => s.id === stepId);
  if (!target) return;

  target.label = newLabel;
  saveStageConfig(sid, pidStr, cfg);

  // 如果之後你想讓歷史紀錄一起更新名稱，可以把下面這段打開，
  // 但記得也要有 pid / sid 才能讀寫紀錄
  /*
  const recs = loadRecords(pidStr, sid) as any[];
  recs.forEach((r) => {
    if (recordMatchStep(r, stageId, stepId, undefined)) {
      r.step = newLabel;       // 舊欄位
      r.stepLabel = newLabel;  // 若有新欄位
    }
  });
  saveRecords(pidStr, recs, sid);
  */
}

/**
 * 刪除 step
 * @param deleteRecords true: 一併刪除歷史紀錄；false: 保留（在文字後面加 "(已刪除)" 標記）
 *
 * ⚠️ 需要 productId / shopId（從 opts 傳入）
 */
export function deleteStep(
  stageId: FixedStageId,
  stepId: string,
  stepLabel: string,
  deleteRecords: boolean,
  opts?: { productId?: string | number; shopId?: string }
) {
  const pid = opts?.productId;
  const sid = opts?.shopId ?? getCurrentShopIdSafe();

  if (!pid) {
    console.warn("[stageOps.deleteStep] missing productId, skip");
    return;
  }

  const pidStr = String(pid);

  // 1) 刪 StageConfig
  const cfg = (loadStageConfig(sid, pidStr) || []) as StageConfig[];
  const stage = cfg.find((s) => s.id === stageId);
  if (!stage) return;

  stage.steps = stage.steps.filter((s) => s.id !== stepId);
  saveStageConfig(sid, pidStr, cfg);

  // 2) 處理歷史紀錄
  const records = loadRecords(pidStr, sid) as any[];

  if (deleteRecords) {
    // 直接把相關紀錄砍掉
    const kept = records.filter(
      (r) => !recordMatchStep(r, stageId, stepId, stepLabel)
    );
    saveRecords(pidStr, kept, sid);
  } else {
    // 保留紀錄：加註 "(已刪除的步驟)"，避免之後看不懂
    const kept = records.map((r) => {
      if (recordMatchStep(r, stageId, stepId, stepLabel)) {
        const suffix = " (已刪除的步驟)";
        if (typeof r.step === "string" && !String(r.step).includes("已刪除")) {
          r.step = String(r.step) + suffix;
        }
        if (
          typeof r.stepLabel === "string" &&
          !String(r.stepLabel).includes("已刪除")
        ) {
          r.stepLabel = String(r.stepLabel) + suffix;
        }
      }
      return r;
    });
    saveRecords(pidStr, kept, sid);
  }
}
