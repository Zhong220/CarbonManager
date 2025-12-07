// src/utils/stageOps.ts
import { loadStageConfig, saveStageConfig, loadRecords, saveRecords } from "@/utils/storage";
import { StageConfig, FixedStageId, UserStep } from "@/utils/lifecycleTypes";

/** 安全比對：同時支援舊資料(用文字)與新資料(用id) */
function recordMatchStep(rec: any, stageId: string, stepId?: string, stepLabel?: string) {
  const stageOk = rec.stageId ? rec.stageId === stageId : rec.stage === stageId;
  if (!stageOk) return false;

  // 盡量用 stepId，比不到再比 label
  if (stepId && (rec.stepId ? rec.stepId === stepId : false)) return true;
  if (stepLabel) return rec.step === stepLabel || rec.stepLabel === stepLabel;
  return false;
}

/** 計算某 step 影響的歷史筆數 */
export function countRecordsForStep(stageId: string, stepId?: string, stepLabel?: string) {
  const records = loadRecords();
  return records.filter((r: any) => recordMatchStep(r, stageId, stepId, stepLabel)).length;
}

/** 重新命名 step（僅改 StageConfig；歷史紀錄保留原本內容） */
export function renameStep(stageId: FixedStageId, stepId: string, newLabel: string) {
  const cfg: StageConfig[] = loadStageConfig();
  const stage = cfg.find(s => s.id === stageId);
  if (!stage) return;

  const target = stage.steps.find(s => s.id === stepId);
  if (!target) return;

  target.label = newLabel;
  saveStageConfig(cfg);

  // 若你希望歷史紀錄也同步顯示新名稱，可選擇一併更新（預設不動）
  // const recs = loadRecords();
  // recs.forEach(r => {
  //   if (recordMatchStep(r, stageId, stepId, undefined)) {
  //     r.step = newLabel;    // 舊結構
  //     r.stepLabel = newLabel; // 若有新欄位
  //   }
  // });
  // saveRecords(recs);
}

/**
 * 刪除 step
 * @param deleteRecords true: 一併刪除歷史紀錄；false: 保留（可選擇在文字後面加 "(已刪除)" 標記）
 */
export function deleteStep(stageId: FixedStageId, stepId: string, stepLabel: string, deleteRecords: boolean) {
  // 1) 刪 StageConfig
  const cfg: StageConfig[] = loadStageConfig();
  const stage = cfg.find(s => s.id === stageId);
  if (!stage) return;

  stage.steps = stage.steps.filter(s => s.id !== stepId);
  saveStageConfig(cfg);

  // 2) 處理歷史紀錄
  const records = loadRecords();

  if (deleteRecords) {
    const kept = records.filter(r => !recordMatchStep(r, stageId, stepId, stepLabel));
    saveRecords(kept);
  } else {
    // 保留紀錄：可選擇加註記，避免之後看不懂來源
    const kept = records.map(r => {
      if (recordMatchStep(r, stageId, stepId, stepLabel)) {
        // 不動金額/排放，只在名稱上標示
        const suffix = " (已刪除的步驟)";
        if (typeof r.step === "string" && !String(r.step).includes("已刪除")) {
          r.step = String(r.step) + suffix;
        }
        if (typeof r.stepLabel === "string" && !String(r.stepLabel).includes("已刪除")) {
          r.stepLabel = String(r.stepLabel) + suffix;
        }
      }
      return r;
    });
    saveRecords(kept);
  }
}
