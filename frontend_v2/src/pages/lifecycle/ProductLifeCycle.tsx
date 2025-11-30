import {
  apiCreateEmission,
  apiSearchFactors,
  apiListFactorsByTag,
  apiListStages,
  apiListEmissionsByProduct,
  apiListStepsByStage,
  apiSaveStepOrder,
  FactorDTO,
  StageRow,
  EmissionDTO,
  StageId, // ★ 新增
} from "@/api/lifecycle";
import React, { useMemo, useEffect, useState } from "react";
import styled from "styled-components";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Autocomplete, TextField } from "@mui/material";
import Modal from "@/ui/components/Modal";
import StageBlock from "@/ui/components/StageBlock";
import HistoryList, { RecordItem } from "@/ui/components/HistoryList";
import { useReport } from "@/context/ReportContext";
import { useUser } from "@/context/UserContext";
import type { EmissionRecord } from "@/utils/lifecycleTypes";

import {
  loadProducts,
  loadStageConfig,
  saveStageConfig,
  getCurrentShopIdSafe,
} from "@/utils/storage";
import {
  FIXED_STAGE_TEMPLATES,
  StageConfig,
  LifeRecord,
  FixedStageId,
  UserStep,
  StepTag,
} from "@/utils/lifecycleTypes";
import { exportToExcel } from "@/utils/export";
import { aggregateByStageAndStep } from "@/utils/aggregateEmissions";
import StageAccordion from "@/ui/components/StageAccordion";
import { FactorBrowser, FactorPick } from "@/ui/components/FactorBrowser";

/** ★★ 關鍵：tag 名稱 → tag_id 對照表 ★★
 *  這裡的數字是暫填的，請依照資料庫裡真正的 id 修改。
 *  你可以進 MySQL 查：
 *    SELECT id, name FROM tags;   （實際表名請依後端為準）
 */
const STEP_TAG_ID_MAP: Partial<Record<StepTag, number>> = {
  // 原料取得
  "種子/種苗": 1,
  農藥: 2,
  肥料: 3,
  其他生產資材: 4,
  整地: 5,
  定植: 6,
  栽培管理: 7,
  採收: 8,
  包裝資材: 9,
  廢棄物: 10,
  能源資源: 11,
  運輸: 12,

  // 製造
  冷藏暫存: 13,
  一次加工: 14,
  半成品暫存: 15,
  二次加工: 16,
  包裝: 17,
  出貨: 18,

  // 配送銷售
  銷售點: 19,

  // 使用
  消費者使用: 20,

  // 廢棄處理
  回收: 21,
  焚化: 22,
  掩埋: 23,
};

function useIsMobile(bp = 720) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= bp : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= bp);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [bp]);
  return isMobile;
}

function mapRole(userType?: "shop" | "customer" | null) {
  if (userType === "shop") return "Farmer";
  if (userType === "customer") return "Consumer";
  return "None";
}

type AnalysisRange = "all" | "7d" | "30d" | "365d";

/* ========== 標的(單一產品) ========== */
type TargetUnit = "kg" | "pack";
interface ProductTarget {
  unit: TargetUnit;
  totalKg?: number;
  packCount?: number;
  gramsPerPack?: number;
  note?: string;
}
const targetKey = (shopId: string, productId: string) =>
  `target:${shopId}:${productId}`;
function loadTarget(shopId: string, productId: string): ProductTarget | null {
  try {
    const raw = localStorage.getItem(targetKey(shopId, productId));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj.unit !== "kg" && obj.unit !== "pack") return null;
    return obj as ProductTarget;
  } catch {
    return null;
  }
}
function saveTarget(shopId: string, productId: string, t: ProductTarget) {
  localStorage.setItem(targetKey(shopId, productId), JSON.stringify(t));
}
function outputMassKg(t?: ProductTarget | null) {
  if (!t) return undefined;
  if (t.unit === "kg")
    return t.totalKg && t.totalKg > 0 ? t.totalKg : undefined;
  const pcs = t.packCount ?? 0,
    gpp = t.gramsPerPack ?? 0;
  if (pcs > 0 && gpp > 0) return (pcs * gpp) / 1000;
  return undefined;
}

/* 後端 emission → LifeRecord 的 mapping（不依賴 emissions.unit） */
function mapEmissionToLifeRecord(row: EmissionDTO & any): LifeRecord {
  const ts =
    typeof row.timestamp === "number"
      ? row.timestamp
      : row.created_at
      ? Math.floor(new Date(row.created_at).getTime() / 1000)
      : undefined;

  const emission =
    row.emission_amount ?? row.total_emission ?? row.emission ?? 0;

  const amount = row.quantity ?? row.amount ?? 0;

  const unit =
    row.factor_unit ?? row.transport_unit ?? row.fuel_input_unit ?? "";

  return {
    id: String(row.id),
    productId: String(row.product_id),
    stageId: (row.stage_id as FixedStageId) ?? "raw",
    stepId: row.step_id
      ? String(row.step_id)
      : row.step_tag
      ? `tag-${row.step_tag}`
      : `step-${row.id}`,
    stepLabel: row.step_name ?? row.step_tag ?? row.name ?? "(未命名步驟)",
    tag: row.step_tag ?? row.tag ?? "",
    material: row.material ?? row.name ?? "",
    amount: Number(amount) || 0,
    unit,
    emission: Number(emission) || 0,
    timestamp: ts,
    date: row.date ?? row.created_at ?? null,
  };
}

/* ========== 主頁面 ========== */
export default function ProductLifeCyclePage() {
  useIsMobile(720);
  const { productId } = useParams<{ productId: string }>();
  const [searchParams] = useSearchParams();
  const explicitShopId = searchParams.get("shop");
  const navigate = useNavigate();

  const { ready, user } = useUser();
  const role = mapRole((user as any)?.user_type ?? null);

  const { exportXlsmByProduct } = useReport();

  const workingShopId = explicitShopId || getCurrentShopIdSafe();
  const canEdit = role === "Farmer";
  const canRead = role !== "None";
  const readOnly = !canEdit;

  const [_stageRows, setStageRows] = useState<StageRow[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!productId) return;
        const rows = await apiListStages(Number(productId));
        setStageRows(rows);
      } catch (e) {
        console.warn("[stages] 無法取得後端 stages，將以快取/覆蓋推斷。", e);
        setStageRows(null);
      }
    })();
  }, [productId]);

  useEffect(() => {
    if (!ready) return;
    if (!canRead) {
      const suffix = explicitShopId
        ? `?shop=${encodeURIComponent(explicitShopId)}`
        : "";
      navigate("/products" + suffix);
    }
  }, [ready, canRead, explicitShopId, navigate]);

  const [productName, setProductName] = useState("");
  const [stages, setStages] = useState<StageConfig[]>([
    ...FIXED_STAGE_TEMPLATES,
  ]);
  const [records, setRecords] = useState<LifeRecord[]>([]);
  const [activeTab, setActiveTab] = useState<
    "lifecycle" | "history" | "analysis"
  >("lifecycle");

  const [target, setTarget] = useState<ProductTarget | null>(null);
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<ProductTarget | null>(
    null
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStep, setSelectedStep] = useState<{
    stageId: FixedStageId;
    step: UserStep;
  } | null>(null);

  const [factorOptions, setFactorOptions] = useState<FactorDTO[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<FactorDTO | null>(
    null
  );

  const [inputAmount, setInputAmount] = useState<string>("");
  const [keyword, setKeyword] = useState(""); // ★ 改用 onInputChange 控制
  const [customMaterialName, setCustomMaterialName] = useState("");
  const [showSavedTip, setShowSavedTip] = useState(false);

  const [cat, setCat] = useState<string>("");
  const [mid, setMid] = useState<string>("");
  const [sub, setSub] = useState<string>("");

  const [range, setRange] = useState<AnalysisRange>("all");

  // ===== 初始化：產品名稱、StageConfig、標的、後端 emissions / steps =====
  useEffect(() => {
    if (!productId || !ready || !canRead) return;
    const shopId = workingShopId;

    const products = loadProducts(shopId);
    const product = products.find(
      (p: any) => String(p.id) === String(productId)
    );
    setProductName(product ? product.name : "");

    let cfg = loadStageConfig(shopId, productId!);
    if (!cfg || !Array.isArray(cfg) || cfg.length === 0) {
      cfg = [...FIXED_STAGE_TEMPLATES];
      if (canEdit) saveStageConfig(shopId, productId!, cfg);
    }
    setStages(cfg);

    setTarget(loadTarget(shopId, productId!));

    const pidNum = Number(productId);

    // 後端 emissions
    (async () => {
      try {
        const list = await apiListEmissionsByProduct(pidNum);
        const mapped = (list || []).map(mapEmissionToLifeRecord);
        setRecords(mapped);
      } catch (e) {
        console.error("[emissions] 載入產品排放紀錄失敗", e);
        setRecords([]);
      }
    })();

    // 後端 steps：若有資料則覆蓋對應階段的 steps
    (async () => {
      try {
        const backendStepsByStage: Record<FixedStageId, UserStep[]> = {
          raw: [],
          manufacture: [],
          distribution: [],
          use: [],
          disposal: [],
        };

        for (const s of FIXED_STAGE_TEMPLATES) {
          const rows = await apiListStepsByStage(s.id as any, {
            productId: pidNum,
          });
          backendStepsByStage[s.id] = rows.map((r) => ({
            id: `db:${r.id}`,
            label: r.name,
            tag: r.tag || r.name,
          }));
        }

        setStages((prev) =>
          prev.map((s) => {
            const backend = backendStepsByStage[s.id];
            if (backend && backend.length) {
              return { ...s, steps: backend };
            }
            return s;
          })
        );
      } catch (e) {
        console.warn(
          "[steps] 載入後端 steps 失敗，暫時使用本地 stageConfig",
          e
        );
      }
    })();
  }, [productId, workingShopId, canRead, canEdit, ready]);

  /** Factors 載入：keyword/三分類優先；否則用 step_tag -> q=tag -> 寬查 */
  useEffect(() => {
    let stop = false;
    const run = async () => {
      if (!selectedStep || !modalOpen) {
        if (!stop) setFactorOptions([]);
        return;
      }
      const hasFilters = !!(cat.trim() || mid.trim() || sub.trim());
      try {
        let list: FactorDTO[] = [];
        if (keyword.trim() || hasFilters) {
          const query: any = { limit: 50 };
          if (keyword.trim()) query.q = keyword.trim();
          if (cat.trim()) query.category = cat.trim();
          if (mid.trim()) query.midcategory = mid.trim();
          if (sub.trim()) query.subcategory = sub.trim();
          list = await apiSearchFactors(query);
        } else {
          list = await apiListFactorsByTag({
            step_tag: selectedStep.step.tag,
            limit: 50,
          });
        }
        if (!stop) setFactorOptions(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error("load factors failed", e);
        if (!stop) setFactorOptions([]);
      }
    };
    const h = setTimeout(run, 250);
    return () => {
      stop = true;
      clearTimeout(h);
    };
  }, [selectedStep, modalOpen, keyword, cat, mid, sub]);

  const parsedCoefficient =
    typeof selectedMaterial?.value_per_unit === "number"
      ? selectedMaterial.value_per_unit!
      : NaN;
  const parsedAmount = parseFloat(inputAmount);
  const emission =
    selectedMaterial &&
    !Number.isNaN(parsedCoefficient) &&
    !Number.isNaN(parsedAmount)
      ? parsedCoefficient * parsedAmount
      : 0;

  const samePlaceHistory = useMemo(() => {
    if (!selectedStep) return [];
    return records
      .filter(
        (r) =>
          r.stageId === selectedStep.stageId &&
          (r.tag === selectedStep.step.tag || r.stepId === selectedStep.step.id)
      )
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  }, [records, selectedStep]);

  const handleStepClick = (stageId: FixedStageId, step: UserStep) => {
    if (readOnly) return;
    setSelectedStep({ stageId, step });
    setSelectedMaterial(null);
    setInputAmount("");
    setKeyword("");
    setCustomMaterialName("");
    setCat("");
    setMid("");
    setSub("");
    setShowSavedTip(false);
    setModalOpen(true);
  };

  // 把原本的 syncStepsToBackend 整個換成這版
  async function syncStepsToBackend(stageId: FixedStageId, steps: UserStep[]) {
    if (!productId) return;
    const pidNum = Number(productId);

    // 找出「這次需要新建到 DB 的步驟」（id 不是 db: 開頭）
    const newSteps = steps.filter((st) => !st.id.startsWith("db:"));
    if (!newSteps.length) {
      console.info("[steps] 沒有新步驟需要同步到後端");
      return;
    }

    const payloadSteps = newSteps
      .map((st) => {
        const tagId = STEP_TAG_ID_MAP[st.tag as StepTag];

        if (!tagId) {
          console.warn(
            "[steps] 無對應 tag_id，略過同步此步驟（只存在 localStorage）",
            st
          );
          return null;
        }

        const sortOrder = steps.findIndex((x) => x.id === st.id) + 1;

        return {
          stage_id: stageId as any as StageId,
          tag_id: tagId,
          name: st.label,
          sort_order: sortOrder,
        };
      })
      .filter(Boolean) as any[];

    if (!payloadSteps.length) {
      console.info(
        "[steps] 沒有任何帶 tag_id 的步驟可同步，略過呼叫後端"
      );
      return;
    }

    try {
      await apiSaveStepOrder(pidNum, stageId as any as StageId, payloadSteps);
      console.log("[steps] 已同步步驟到後端", payloadSteps);
    } catch (e) {
      console.error(
        "[steps] 同步步驟到後端失敗（略過，不影響 UI）",
        e
      );
    }
  }

  const addUserStep = (stageId: FixedStageId, label: string, tag: StepTag) => {
    if (readOnly) return;
    setStages((prev) => {
      const next = prev.map((s) =>
        s.id !== stageId
          ? s
          : {
              ...s,
              steps: [
                ...s.steps,
                {
                  id:
                    (crypto as any).randomUUID?.() ??
                    `${Date.now()}-${Math.random()}`,
                  label,
                  tag,
                },
              ],
            }
      );
      saveStageConfig(workingShopId, productId!, next);

      // 同步到後端（fire-and-forget）
      const targetStage = next.find((s) => s.id === stageId);
      if (targetStage) {
        void syncStepsToBackend(stageId, targetStage.steps);
      }
      return next;
    });
  };

  const reorderLinear = (
    stageId: FixedStageId,
    sourceId: string,
    targetId: string | null
  ) => {
    if (readOnly) return;
    setStages((prev) => {
      const next = prev.map((s) => {
        if (s.id !== stageId) return s;
        const from = s.steps.findIndex((x) => x.id === sourceId);
        if (from === -1) return s;
        const arr = s.steps.slice();
        const [moved] = arr.splice(from, 1);
        const to =
          targetId === null
            ? arr.length
            : arr.findIndex((x) => x.id === targetId);
        if (to === -1) return s;
        arr.splice(to, 0, moved);
        return { ...s, steps: arr };
      });
      saveStageConfig(workingShopId, productId!, next);

      const targetStage = next.find((s) => s.id === stageId);
      if (targetStage) {
        void syncStepsToBackend(stageId, targetStage.steps);
      }
      return next;
    });
  };

  // ★★★ 重點修正區：每次都是「新增一筆 emission」，不再合併同 stage ★★★
  const handleSaveRecord = async () => {
    if (readOnly || !selectedStep) return;
    const amt = parseFloat(inputAmount);
    if (!selectedMaterial || Number.isNaN(amt) || amt <= 0) {
      alert("請選擇係數並輸入用量");
      return;
    }

    const factorName = String(selectedMaterial.name).trim();
    const nowTs = Math.floor(Date.now() / 1000);
    const pidNum = Number(productId);
    const emissionValue = +(parsedCoefficient * amt).toFixed(3);

    console.log("[emission] create new (always POST)", {
      productId: pidNum,
      stageId: selectedStep.stageId,
      factorId: selectedMaterial.id,
      amt,
      emissionValue,
    });

    const newItem: LifeRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      productId: productId!,
      stageId: selectedStep.stageId,
      stepId: selectedStep.step.id,
      stepLabel: selectedStep.step.label,
      tag: selectedStep.step.tag,
      material: factorName,
      amount: amt,
      unit: selectedMaterial.unit || "",
      emission: emissionValue,
      timestamp: nowTs,
      date: new Date(nowTs * 1000).toISOString(),
    };

    const prevRecords = records.slice();
    setRecords((prev) => [...prev, newItem]);

    try {
      console.log("[emission] POST /emissions payload", {
        fixedStage: selectedStep.stageId,
        step_tag: newItem.tag,
        name:
          customMaterialName || selectedMaterial?.name || newItem.material,
        factor_id: selectedMaterial?.id ?? null,
        quantity: amt,
        material: newItem.material,
        amount: newItem.amount,
        emission_amount: Number(newItem.emission) || 0,
        timestamp: newItem.timestamp ?? null,
        date: newItem.date ?? null,
        note: null,
      });

      await apiCreateEmission(pidNum, {
        fixedStage: selectedStep.stageId,
        step_tag: newItem.tag,
        name:
          customMaterialName || selectedMaterial?.name || newItem.material,
        factor_id: selectedMaterial?.id ?? null,
        quantity: amt,
        material: newItem.material,
        amount: newItem.amount,
        emission_amount: Number(newItem.emission) || 0,
        timestamp: newItem.timestamp ?? null,
        date: newItem.date ?? null,
        note: null,
      });

      // 再重抓一次後端資料，確認 DB 的真實狀態
      try {
        const list = await apiListEmissionsByProduct(pidNum);
        const mapped = (list || []).map(mapEmissionToLifeRecord);
        setRecords(mapped);
        console.log("[emission] reload from backend", mapped);
      } catch (e) {
        console.warn("[emissions] 重新載入失敗，暫時沿用前端狀態", e);
      }

      setInputAmount("");
      setSelectedMaterial(null);
      setKeyword("");
      setCustomMaterialName("");
      setShowSavedTip(true);
      setTimeout(() => setShowSavedTip(false), 1200);
    } catch (e: any) {
      console.error("同步 emission 到後端失敗，回滾本地變更", e);
      setRecords(prevRecords);
      alert(
        "寫入失敗，已回滾本地紀錄。\n\n" + String(e?.message || e || "Unknown")
      );
    }
  };

  const handleExport = () => {
    const legacy = records.map((r) => {
      const stageTitle = stages.find((s) => s.id === r.stageId)?.title ?? "";
      return {
        id: r.id,
        productId: r.productId,
        stage: stageTitle,
        step: r.tag,
        material: r.material,
        amount: r.amount,
        unit: r.unit,
        emission: r.emission,
        timestamp: r.timestamp,
        date: r.date,
      };
    });
    exportToExcel(legacy, productName);
  };

  const saveAndReturn = () => {
    if (!readOnly) {
      saveStageConfig(workingShopId, productId!, stages);
    }
    const suffix = explicitShopId
      ? `?shop=${encodeURIComponent(explicitShopId)}`
      : "";
    navigate("/products" + suffix);
  };

  const historyItems: RecordItem[] = useMemo(
    () =>
      records
        .map((r) => ({
          id: r.id,
          productName,
          step: r.tag,
          stage: stages.find((s) => s.id === r.stageId)?.title ?? "",
          material: r.material,
          amount: r.amount,
          unit: r.unit,
          emission: r.emission,
          timestamp: r.timestamp ?? 0,
          date: r.date,
        }))
        .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)),
    [records, stages, productName]
  );

  const handleHistoryEdit = (id: string, patch: Partial<RecordItem>) => {
    if (readOnly) return;
    // 這裡暫時只改前端顯示，真正更新 DB 的邏輯可以之後再補
    setRecords((prev) => {
      const next = prev.map((r) => {
        if (r.id !== id) return r;
        const newAmount =
          typeof patch.amount === "number" &&
          !Number.isNaN(patch.amount) &&
          patch.amount > 0
            ? patch.amount
            : r.amount;
        const newMaterial =
          patch.material !== undefined ? String(patch.material) : r.material;
        const newUnit = patch.unit !== undefined ? String(patch.unit) : r.unit;

        let newEmission = r.emission;
        if (r.amount > 0 && Number.isFinite(Number(r.emission))) {
          const ratio = Number(r.emission) / r.amount;
          newEmission = +(ratio * newAmount).toFixed(3);
        }

        return {
          ...r,
          material: newMaterial,
          unit: newUnit,
          amount: newAmount,
          emission: newEmission,
        };
      });
      return next;
    });
  };

  const handleHistoryDelete = (id: string) => {
    if (readOnly) return;
    // 同上，暫時只刪前端記錄，之後可接 apiDeleteEmission
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const nowSec = Math.floor(Date.now() / 1000);
  const sinceSec = useMemo(() => {
    switch (range) {
      case "7d":
        return nowSec - 7 * 86400;
      case "30d":
        return nowSec - 30 * 86400;
      case "365d":
        return nowSec - 365 * 86400;
      default:
        return 0;
    }
  }, [range, nowSec]);

  const analysisRecords = useMemo(
    () => records.filter((r) => !r.timestamp || r.timestamp >= sinceSec),
    [records, sinceSec]
  );

  const totalEmission = useMemo(
    () => analysisRecords.reduce((s, r) => s + (Number(r.emission) || 0), 0),
    [analysisRecords]
  );

  const byMaterial = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of analysisRecords) {
      const key = r.material || "(未填係數名)";
      m.set(key, (m.get(key) || 0) + (Number(r.emission) || 0));
    }
    return [...m.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [analysisRecords]);

  const outKg = outputMassKg(target);
  const perKg = outKg && outKg > 0 ? totalEmission / outKg : undefined;
  const perPack =
    target?.unit === "pack" && target.packCount && target.packCount > 0
      ? totalEmission / target.packCount
      : undefined;

  const recordsForAgg: EmissionRecord[] = useMemo(() => {
    return analysisRecords.map((r) => ({
      id: r.id,
      stageId: r.stageId,
      stageName: stages.find((s) => s.id === r.stageId)?.title ?? r.stageId,
      stepId: r.stepId,
      stepName: r.stepLabel ?? r.tag,
      valueKgCO2e: Number(r.emission) || 0,
      ts: r.timestamp,
    }));
  }, [analysisRecords, stages]);

  const stageAgg = useMemo(
    () => aggregateByStageAndStep(recordsForAgg),
    [recordsForAgg]
  );

  const openTarget = () => {
    if (readOnly) return;
    setEditingTarget(
      target ?? {
        unit: "pack",
        packCount: undefined,
        gramsPerPack: undefined,
        totalKg: undefined,
        note: undefined,
      }
    );
    setTargetModalOpen(true);
  };
  const persistTarget = () => {
    if (!editingTarget || readOnly) return;
    const t = editingTarget;
    const ok =
      t.unit === "kg"
        ? !!(t.totalKg && t.totalKg > 0)
        : !!(
            t.packCount &&
            t.packCount > 0 &&
            t.gramsPerPack &&
            t.gramsPerPack > 0
          );
    if (!ok) {
      alert("請完整填寫標的資料");
      return;
    }
    saveTarget(workingShopId, productId!, t);
    setTarget(t);
    setTargetModalOpen(false);
  };

  if (!productId) {
    return (
      <Shell>
        <NoteCard>無效的商品，缺少 productId。</NoteCard>
      </Shell>
    );
  }

  if (!ready) {
    return (
      <Shell>
        <NoteCard>載入中…</NoteCard>
      </Shell>
    );
  }

  return (
    <Shell>
      <Header>
        <BackBtn onClick={saveAndReturn} aria-label="返回">
          ←
        </BackBtn>
        <Title>
          {productName || "產品"}
          {readOnly && <Muted>（檢視模式）</Muted>}
        </Title>
        {!readOnly && (
          <OutlineBtn onClick={openTarget} style={{ marginLeft: "auto" }}>
            {target ? "編輯標的" : "設定標的"}
          </OutlineBtn>
        )}
      </Header>

      {/* 目標資訊條 */}
      <TargetBar>
        {target ? (
          target.unit === "kg" ? (
            <>
              <Chip>標的</Chip>
              <Strong>{target.totalKg}</Strong>
              <Unit>kg</Unit>
            </>
          ) : (
            <>
              <Chip>標的</Chip>
              <Strong>{target.packCount}</Strong>
              <Unit> 包</Unit>
              <Sep>·</Sep>
              <Label>單件</Label>&nbsp;<Strong>{target.gramsPerPack}</Strong>
              <Unit> g</Unit>
              <Sep>·</Sep>
              <Label>總重</Label>&nbsp;
              <Strong>{(outputMassKg(target) ?? 0).toFixed(2)}</Strong>
              <Unit> kg</Unit>
            </>
          )
        ) : (
          <Muted>尚未設定標的</Muted>
        )}
      </TargetBar>

      <Tabs>
        <Seg
          $active={activeTab === "lifecycle"}
          onClick={() => setActiveTab("lifecycle")}
        >
          生產過程
        </Seg>
        <Seg
          $active={activeTab === "history"}
          onClick={() => setActiveTab("history")}
        >
          歷史紀錄
        </Seg>
        <Seg
          $active={activeTab === "analysis"}
          onClick={() => setActiveTab("analysis")}
        >
          碳排總覽
        </Seg>
      </Tabs>

      {activeTab === "lifecycle" && (
        <Stack $gap={12}>
          {stages.every((s) => s.steps.length === 0) && (
            <NoteCard>
              尚未建立任何步驟，請在各階段按「＋新增步驟」建立（需選既有標籤）。
            </NoteCard>
          )}
          {stages.map((stage) => (
            <Card key={stage.id}>
              <StageBlock
                stage={stage}
                productId={productId}
                readOnly={readOnly}
                onStepClick={handleStepClick}
                onAddStep={addUserStep}
                onReorderStep={reorderLinear}
              />
            </Card>
          ))}
        </Stack>
      )}

      {activeTab === "history" && (
        <Stack $gap={12}>
          <Row $right>
            <OutlineBtn onClick={handleExport}>匯出報表</OutlineBtn>
          </Row>
          <Card>
            <HistoryList
              records={historyItems}
              onEdit={readOnly ? undefined : handleHistoryEdit}
              onDelete={readOnly ? undefined : handleHistoryDelete}
            />
          </Card>
        </Stack>
      )}

      {activeTab === "analysis" && (
        <Stack $gap={12}>
          <Row $wrap $gap={8} $align="center">
            <Muted>
              {target ? (
                target.unit === "kg" ? (
                  <>標的總重：{target.totalKg} kg</>
                ) : (
                  <>
                    標的：{target.packCount} 包，單件 {target.gramsPerPack} g
                    （總重 {(outputMassKg(target) ?? 0).toFixed(2)} kg）
                  </>
                )
              ) : (
                <>尚未設定標的</>
              )}
            </Muted>
            <Fill />
            <Segment>
              {(["all", "7d", "30d", "365d"] as AnalysisRange[]).map((opt) => (
                <SegSmall
                  key={opt}
                  $active={range === opt}
                  onClick={() => setRange(opt)}
                >
                  {opt === "all"
                    ? "全部"
                    : opt === "7d"
                    ? "近7天"
                    : opt === "30d"
                    ? "近30天"
                    : "近一年"}
                </SegSmall>
              ))}
            </Segment>
          </Row>

          <StatGrid>
            <StatCard>
              <StatLabel>總排放量</StatLabel>
              <StatValue>
                {totalEmission.toFixed(2)}
                <small> kg CO₂e</small>
              </StatValue>
            </StatCard>
            <StatCard>
              <StatLabel>每 kg</StatLabel>
              <StatValue>
                {perKg !== undefined ? perKg.toFixed(3) : "-"}
                <small> kg CO₂e / kg</small>
              </StatValue>
            </StatCard>
            <StatCard>
              <StatLabel>每包</StatLabel>
              <StatValue>
                {perPack !== undefined ? perPack.toFixed(3) : "-"}
                <small> kg CO₂e / 包</small>
              </StatValue>
            </StatCard>
            <StatCard>
              <StatLabel>筆數</StatLabel>
              <StatValue>{analysisRecords.length}</StatValue>
            </StatCard>
          </StatGrid>

          <GridTwo>
            <TableCard>
              <TableTitle>依階段（含步驟明細）</TableTitle>
              {stageAgg.byStage.length === 0 ? (
                <Muted>目前區間沒有資料</Muted>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {stageAgg.byStage.map((stage, i) => (
                    <StageAccordion
                      key={stage.stageId}
                      data={stage}
                      grandTotal={stageAgg.grandTotal}
                      defaultOpen={i === 0}
                    />
                  ))}
                </div>
              )}
            </TableCard>

            <TableCard>
              <TableTitle>依係數（Top 10）</TableTitle>
              {byMaterial.length === 0 ? (
                <Muted>目前區間沒有資料</Muted>
              ) : (
                <Table>
                  <tbody>
                    {byMaterial.map((row) => (
                      <tr key={row.label}>
                        <td>{row.label}</td>
                        <td className="num">{row.value.toFixed(2)} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </TableCard>
          </GridTwo>
        </Stack>
      )}

      {!readOnly && (
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} size="md">
          {selectedStep && (
            <ModalBody>
              <h3>新增碳排放紀錄</h3>
              <h5 style={{ margin: 0 }}>
                階段：
                {stages.find((s) => s.id === selectedStep.stageId)?.title ?? ""}
              </h5>
              <h5 style={{ margin: "4px 0 12px" }}>
                步驟：{selectedStep.step.label}{" "}
                <span style={{ opacity: 0.6 }}>#{selectedStep.step.tag}</span>
              </h5>

              {target ? (
                <Info>
                  標的摘要：
                  {target.unit === "kg"
                    ? `總重 ${target.totalKg} kg`
                    : `${target.packCount} 包 × ${
                        target.gramsPerPack
                      } g（總重 ${(outputMassKg(target) ?? 0).toFixed(2)} kg）`}
                </Info>
              ) : (
                <Warn>尚未設定標的，建議先設定以便產出每 kg/每包數值。</Warn>
              )}

              {showSavedTip && <Ok>✅ 已新增！</Ok>}

              <Input
                placeholder="輸入項目名稱（顯示用，可留空）"
                value={customMaterialName}
                onChange={(e) => setCustomMaterialName(e.target.value)}
              />

              <FactorBrowser
                value={{
                  category: cat || undefined,
                  midcategory: mid || undefined,
                  subcategory: sub || undefined,
                }}
                onChange={(pick: FactorPick) => {
                  setCat(pick.category ?? "");
                  setMid(pick.midcategory ?? "");
                  setSub(pick.subcategory ?? "");
                  setKeyword(""); // ★ 切換分類時清關鍵字
                }}
              />

              <Autocomplete
                options={factorOptions}
                noOptionsText={
                  keyword || cat || mid || sub ? "查無結果" : "載入中或尚無資料"
                }
                getOptionLabel={(o: FactorDTO) =>
                  o ? `${o.name}${o.unit ? `（${o.unit}）` : ""}` : ""
                }
                isOptionEqualToValue={(o: FactorDTO, v: FactorDTO) =>
                  o?.id === v?.id
                }
                renderOption={(props, option: FactorDTO) => (
                  <li {...props} key={option.id}>
                    {option.name} {option.unit ? `（${option.unit}）` : ""}
                  </li>
                )}
                onChange={(e, val) => setSelectedMaterial(val)}
                onInputChange={(e, val) => setKeyword(val ?? "")} // ★ 正確綁定輸入
                value={selectedMaterial}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="選擇係數（可輸入關鍵字過濾）"
                    variant="outlined"
                  />
                )}
                sx={{ marginBottom: "10px" }}
              />

              <Row $align="center" $gap={8}>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  placeholder="輸入用量"
                  style={{ flex: 1 }}
                />
                <Muted>{selectedMaterial?.unit ?? ""}</Muted>
              </Row>

              <p style={{ margin: "8px 0", color: "var(--muted)" }}>
                預估碳排量：
                {(isFinite(emission) ? emission : 0).toFixed(2)} kg CO₂e
              </p>

              <HistoryBox>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  過往紀錄（{samePlaceHistory.length} 筆）
                </div>
                {samePlaceHistory.length === 0 ? (
                  <Muted>目前無任何紀錄</Muted>
                ) : (
                  samePlaceHistory.map((r, idx) => (
                    <HistoryRow key={idx}>
                      <span>
                        {r.material} × {r.amount}
                        {r.unit ? ` ${r.unit}` : ""}（{r.emission} kg）
                      </span>
                      <SmallMuted>
                        {r.timestamp
                          ? new Date(r.timestamp * 1000).toLocaleString()
                          : ""}
                      </SmallMuted>
                    </HistoryRow>
                  ))
                )}
              </HistoryBox>

              <Row $gap={8} style={{ marginTop: 12 }}>
                <PrimaryBtn onClick={handleSaveRecord}>確認提交</PrimaryBtn>
                <GhostBtn onClick={() => setModalOpen(false)}>取消</GhostBtn>
              </Row>
            </ModalBody>
          )}
        </Modal>
      )}

      {!readOnly && (
        <Modal
          open={targetModalOpen}
          onClose={() => setTargetModalOpen(false)}
          size="sm"
        >
          {!!editingTarget && (
            <ModalBody style={{ maxWidth: 480 }}>
              <h3 style={{ marginTop: 0 }}>標的設定</h3>

              <Stack $gap={10}>
                <Label>計量方式</Label>
                <Select
                  value={editingTarget.unit}
                  onChange={(e) =>
                    setEditingTarget({
                      unit: e.target.value as TargetUnit,
                      totalKg: undefined,
                      packCount: undefined,
                      gramsPerPack: undefined,
                      note: editingTarget.note,
                    })
                  }
                >
                  <option value="pack">分裝（包）</option>
                  <option value="kg">直接以 kg</option>
                </Select>

                {editingTarget.unit === "kg" ? (
                  <>
                    <Label>總重量（kg）</Label>
                    <Input
                      type="number"
                      step="any"
                      value={editingTarget.totalKg ?? ""}
                      onChange={(e) =>
                        setEditingTarget({
                          ...editingTarget,
                          totalKg: e.target.value ? +e.target.value : undefined,
                        })
                      }
                    />
                  </>
                ) : (
                  <>
                    <Label>總產量（包）</Label>
                    <Input
                      type="number"
                      step="1"
                      value={editingTarget.packCount ?? ""}
                      onChange={(e) =>
                        setEditingTarget({
                          ...editingTarget,
                          packCount: e.target.value
                            ? +e.target.value
                            : undefined,
                        })
                      }
                    />
                    <Label>單件裸裝重量（g，不含包材）</Label>
                    <Input
                      type="number"
                      step="any"
                      value={editingTarget.gramsPerPack ?? ""}
                      onChange={(e) =>
                        setEditingTarget({
                          ...editingTarget,
                          gramsPerPack: e.target.value
                            ? +e.target.value
                            : undefined,
                        })
                      }
                    />
                  </>
                )}

                <Label>備註（選填）</Label>
                <Input
                  value={editingTarget.note ?? ""}
                  onChange={(e) =>
                    setEditingTarget({
                      ...editingTarget,
                      note: e.target.value,
                    })
                  }
                />

                <Info>
                  產品總重量（kg，不含包裝）：{" "}
                  <b>{(outputMassKg(editingTarget) ?? 0).toFixed(3)}</b>
                </Info>
              </Stack>

              <Row $gap={8} style={{ marginTop: 14 }}>
                <PrimaryBtn onClick={persistTarget}>儲存</PrimaryBtn>
                <GhostBtn onClick={() => setTargetModalOpen(false)}>
                  取消
                </GhostBtn>
              </Row>
            </ModalBody>
          )}
        </Modal>
      )}
    </Shell>
  );
}

/* =================== styled =================== */
const Shell = styled.div`
  max-width: var(--shell-max);
  margin: 0 auto;
  padding: var(--space-3);
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
`;
const BackBtn = styled.button`
  border: 1px solid var(--line);
  background: var(--card);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
`;
const Title = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--accent-ink);
`;
const Muted = styled.span`
  color: var(--muted);
`;
const SmallMuted = styled.span`
  color: var(--muted);
  font-size: 12px;
`;
const Label = styled.div`
  font-size: 12px;
  color: var(--muted);
`;
const Sep = styled.span`
  color: var(--muted);
  padding: 0 6px;
`;
const Unit = styled.span`
  color: var(--muted);
  margin-left: 2px;
`;
const Strong = styled.span`
  font-weight: 300;
  font-size: 16px;
  color: var(--accent-ink);
`;

const OutlineBtn = styled.button`
  border: 1px solid var(--line);
  background: var(--card);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
`;

const TargetBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  background: var(--chip);
  border: 1px solid var(--line);
  padding: 8px 12px;
  border-radius: var(--radius);
  margin-bottom: var(--space-3);
`;
const Chip = styled.span`
  background: var(--card);
  border: 1px solid var(--line);
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  color: var(--muted);
`;

const Tabs = styled.div`
  background: #f2f7f2;
  border: 1px solid var(--line);
  border-radius: 999px;
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: var(--space-3);
`;
const Seg = styled.button<{ $active?: boolean }>`
  border: 0;
  padding: 8px 14px;
  border-radius: 999px;
  cursor: pointer;
  background: ${({ $active }) => ($active ? "var(--accent)" : "transparent")};
  color: ${({ $active }) => ($active ? "#fff" : "var(--text)")};
  font-weight: ${({ $active }) => ($active ? 500 : 300)};
`;
const Segment = styled.div`
  display: inline-flex;
  gap: 6px;
  background: #f2f7f2;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 4px;
`;
const SegSmall = styled(Seg)`
  padding: 6px 10px;
  font-size: 13px;
`;

const Card = styled.div`
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: var(--space-3);
`;
const NoteCard = styled(Card)`
  background: #fffbea;
  border-color: #ffe8a3;
  color: #614700;
`;

const Stack = styled.div<{ $gap?: number }>`
  display: grid;
  gap: ${({ $gap }) => $gap ?? 10}px;
`;
const Row = styled.div<{
  $right?: boolean;
  $wrap?: boolean;
  $gap?: number;
  $align?: string;
}>`
  display: flex;
  gap: ${({ $gap }) => $gap ?? 10}px;
  ${({ $wrap }) => $wrap && "flex-wrap: wrap;"}
  ${({ $align }) => $align && `align-items: ${$align};`}
  ${({ $right }) => $right && "justify-content: flex-end;"}
`;
const Fill = styled.div`
  flex: 1;
`;

const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-3);
`;
const StatCard = styled(Card)`
  display: grid;
  gap: 6px;
`;
const StatLabel = styled.div`
  color: var(--muted);
  font-size: 12px;
`;
const StatValue = styled.div`
  font-weight: 300;
  font-size: 28px;
  color: var(--accent-ink);
  small {
    font-weight: 300;
    font-size: 12px;
    color: var(--muted);
    margin-left: 4px;
  }
`;

const GridTwo = styled.div`
  display: grid;
  gap: var(--space-3);
  grid-template-columns: 1fr;
  @media (min-width: 900px) {
    grid-template-columns: 1fr 1fr;
  }
`;
const TableCard = styled(Card)``;
const TableTitle = styled.div`
  font-weight: 300;
  margin-bottom: 8px;
`;
const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  td {
    padding: 8px 2px;
    border-bottom: 1px solid var(--line);
  }
  td.num {
    text-align: right;
    white-space: nowrap;
  }
`;

const ModalBody = styled.div`
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  padding: 20px;
`;
const Input = styled.input`
  width: 100%;
  padding: 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
`;
const Select = styled.select`
  width: 100%;
  padding: 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  background: var(--card);
`;
const Info = styled.p`
  margin: 6px 0 12px;
  font-size: 13px;
  color: var(--accent-ink);
  background: var(--chip);
  border: 1px solid var(--line);
  padding: 8px 10px;
  border-radius: var(--radius-sm);
`;
const Warn = styled.p`
  margin: 6px 0 12px;
  color: var(--warn);
`;
const Ok = styled.p`
  margin: 6px 0 12px;
  color: #2e7d32;
  background: rgba(46, 125, 50, 0.1);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13px;
`;
const HistoryBox = styled.div`
  margin: 16px 0 8px;
  padding: 8px 12px;
  background: #f7f7f7;
  border-radius: var(--radius);
  max-height: 160px;
  overflow: auto;
  border: 1px solid #ececec;
`;
const HistoryRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  &:last-child {
    border-bottom: 0;
  }
`;

const PrimaryBtn = styled.button`
  background: var(--accent);
  color: #fff;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  font-weight: 300;
`;
const GhostBtn = styled.button`
  background: #eee;
  color: #333;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
`;
