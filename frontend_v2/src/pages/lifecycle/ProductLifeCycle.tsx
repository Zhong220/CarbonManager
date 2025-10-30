// src/pages/ProductLifeCyclePage.tsx
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
  loadRecords,
  saveRecords,
  getCurrentShopIdSafe,
  loadStageConfig,
  saveStageConfig,
  // 🔽 新增：拿 owner 與帳號、預設店鋪
  getShopsMap,
  getAccount,
  DEFAULT_SHOP_ID,
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
import emissionFactors from "@/assets/emissionFactors_with_defaults.json";
import { aggregateByStageAndStep } from "@/utils/aggregateEmissions";
import StageAccordion from "@/ui/components/StageAccordion";

/* ========== 小工具 ========== */
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
    if (!obj || typeof obj !== "object") return null;
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

/* 舊資料 → 新結構 */
function migrateOldRecordsIfNeeded(
  oldRecords: any[],
  cfg: StageConfig[]
): { changed: boolean; records: LifeRecord[] } {
  let changed = false;
  const byTitle: Record<string, StageConfig> = Object.fromEntries(
    cfg.map((s) => [s.title, s])
  );
  const records: LifeRecord[] = (oldRecords || []).map((r: any) => {
    if (r.stageId && r.stepId && r.tag) return r as LifeRecord;
    const stageCfg = byTitle[r.stage] || cfg[0];
    const tag = r.step;
    const userStep = stageCfg.steps.find((s) => s.tag === tag);
    changed = true;
    return {
      id: String(r.id ?? Date.now()),
      productId: String(r.productId ?? ""),
      stageId: stageCfg.id,
      stepId: userStep?.id ?? `legacy-${tag}`,
      stepLabel: r.step ?? tag,
      tag,
      material: r.material,
      amount: r.amount,
      unit: r.unit ?? "",
      emission: r.emission ?? 0,
      timestamp: r.timestamp,
      date: r.date,
    };
  });
  return { changed, records };
}

function findCoefficient(tag: string, material?: string, unit?: string) {
  const list = (emissionFactors as any[]).filter(
    (f: any) =>
      Array.isArray(f.applicableSteps) && f.applicableSteps.includes(tag)
  );
  const hit = list.find(
    (f: any) =>
      String(f.name).trim() === String(material ?? "").trim() &&
      String(f.unit ?? "").trim() === String(unit ?? "").trim()
  );
  const raw = hit?.coefficient ?? hit?.coe;
  const parsed =
    raw !== undefined && raw !== null ? parseFloat(String(raw)) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

type AnalysisRange = "all" | "7d" | "30d" | "365d";

/* ========== 主頁面 ========== */
export default function ProductLifeCyclePage() {
  useIsMobile(720); // 目前未使用，但保留以利之後 RWD 行為
  const { productId } = useParams<{ productId: string }>();
  const [searchParams] = useSearchParams();
  const explicitShopId = searchParams.get("shop");
  const navigate = useNavigate();

  const { role } = useUser();
  const { exportXlsmByProduct } = useReport();

  // === 權限計算（純前端） ===
  const workingShopId = explicitShopId || getCurrentShopIdSafe();
  const account = getAccount();
  const shopsMap = useMemo(() => getShopsMap(), []);
  const isOwner =
    !!workingShopId &&
    !!account &&
    role === "Farmer" &&
    shopsMap[workingShopId]?.owner === account;

  const canEdit = isOwner; // 只有店主可寫
  const canRead =
    role === "Consumer" ||
    canEdit ||
    (workingShopId === DEFAULT_SHOP_ID && role !== "None");

  const readOnly = !canEdit;

  // 沒有讀權限就導回產品列表
  useEffect(() => {
    if (!canRead) {
      const suffix = explicitShopId
        ? `?shop=${encodeURIComponent(explicitShopId)}`
        : "";
      navigate("/products" + suffix);
    }
  }, [canRead, explicitShopId, navigate]);

  const [productName, setProductName] = useState("");
  const [stages, setStages] = useState<StageConfig[]>([
    ...FIXED_STAGE_TEMPLATES,
  ]);
  const [records, setRecords] = useState<LifeRecord[]>([]);
  const [activeTab, setActiveTab] = useState<
    "lifecycle" | "history" | "analysis"
  >("lifecycle");

  // 標的
  const [target, setTarget] = useState<ProductTarget | null>(null);
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<ProductTarget | null>(
    null
  );

  // 新增紀錄 Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStep, setSelectedStep] = useState<{
    stageId: FixedStageId;
    step: UserStep;
  } | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [inputAmount, setInputAmount] = useState<string>("");
  const [customMaterialName, setCustomMaterialName] = useState("");
  const [showSavedTip, setShowSavedTip] = useState(false);

  // 總覽區間
  const [range, setRange] = useState<AnalysisRange>("all");

  useEffect(() => {
    if (!productId || !canRead) return;
    const shopId = workingShopId;

    const products = loadProducts(shopId);
    const product = products.find(
      (p: any) => String(p.id) === String(productId)
    );
    setProductName(product ? product.name : "");

    let cfg = loadStageConfig(shopId, productId!);
    if (!cfg || !Array.isArray(cfg) || cfg.length === 0) {
      cfg = [...FIXED_STAGE_TEMPLATES];
      // 只有有寫權限才寫入模板
      if (canEdit) saveStageConfig(shopId, productId!, cfg);
    }
    setStages(cfg);

    const loaded = loadRecords(productId!, shopId) as any[];
    const migrated = migrateOldRecordsIfNeeded(loaded, cfg);
    if (migrated.changed) {
      setRecords(migrated.records);
      if (canEdit) saveRecords(productId!, migrated.records, shopId);
    } else {
      setRecords(loaded as LifeRecord[]);
    }

    setTarget(loadTarget(shopId, productId!));
  }, [productId, workingShopId, canRead, canEdit]);

  const matchedOptions = useMemo(() => {
    const tag = selectedStep?.step.tag || "";
    const filtered = (emissionFactors as any[]).filter((f: any) =>
      f.applicableSteps?.includes(tag)
    );
    const uniqMap = new Map<string, any>();
    filtered.forEach((o: any) => {
      const key = `${o.name}__${o.unit ?? ""}`;
      if (!uniqMap.has(key)) uniqMap.set(key, o);
    });
    return Array.from(uniqMap.values());
  }, [selectedStep]);

  const rawCoefficient =
    selectedMaterial?.coefficient ?? selectedMaterial?.coe ?? "";
  const parsedCoefficient = parseFloat(rawCoefficient);
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
          r.stepId === selectedStep.step.id
      )
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  }, [records, selectedStep]);

  const handleStepClick = (stageId: FixedStageId, step: UserStep) => {
    if (readOnly) return;
    setSelectedStep({ stageId, step });
    setSelectedMaterial(null);
    setInputAmount("");
    setCustomMaterialName("");
    setShowSavedTip(false);
    setModalOpen(true);
  };

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
      return next;
    });
  };

  const handleSaveRecord = () => {
    if (readOnly || !selectedStep) return;
    const amt = parseFloat(inputAmount);
    if (!selectedMaterial || Number.isNaN(amt) || amt <= 0) {
      alert("請選擇係數並輸入用量");
      return;
    }
    const factorName = String(selectedMaterial.name).trim();
    const nowTs = Math.floor(Date.now() / 1000);

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
      emission: +(parsedCoefficient * amt).toFixed(3),
      timestamp: nowTs,
      date: new Date(nowTs * 1000).toISOString(),
    };

    const next = [...records, newItem];
    setRecords(next);
    saveRecords(productId!, next, workingShopId);

    setInputAmount("");
    setSelectedMaterial(null);
    setCustomMaterialName("");
    setShowSavedTip(true);
    setTimeout(() => setShowSavedTip(false), 1200);
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
      saveRecords(productId!, records, workingShopId);
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

        let coef = findCoefficient(r.tag, newMaterial, newUnit);
        if (
          (coef === undefined || !Number.isFinite(coef)) &&
          r.amount > 0 &&
          Number.isFinite(r.emission as number)
        ) {
          coef = Number(r.emission) / r.amount;
        }
        const newEmission =
          coef !== undefined && Number.isFinite(coef)
            ? +(coef * newAmount).toFixed(3)
            : r.emission;

        return {
          ...r,
          material: newMaterial,
          unit: newUnit,
          amount: newAmount,
          emission: newEmission,
        };
      });
      saveRecords(productId!, next, workingShopId);
      return next;
    });
  };

  const handleHistoryDelete = (id: string) => {
    if (readOnly) return;
    setRecords((prev) => {
      const next = prev.filter((r) => r.id !== id);
      saveRecords(productId!, next, workingShopId);
      return next;
    });
  };

  /* 總覽計算 */
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

  // 依係數 Top10
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

  /* === 準備 Stage/Step 彙總 === */
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

  /* 標的編輯 */
  const openTarget = () => {
    if (readOnly) return;
    setEditingTarget(
      target ?? {
        unit: "pack",
        packCount: undefined,
        gramsPerPack: undefined,
        totalKg: undefined,
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

  // === productId 防呆 ===
  if (!productId) {
    return (
      <Shell>
        <NoteCard>無效的商品，缺少 productId。</NoteCard>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Header */}
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

      {/* 分頁（膠囊） */}
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

      {/* ===== 內容 ===== */}
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
                productId={productId} // ← 必傳！用路由的 productId
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
          {/* 區間與目標摘要（輕量） */}
          <Row $wrap $gap={8} $align="center">
            <Muted>
              {target ? (
                target.unit === "kg" ? (
                  <>標的總重：{target.totalKg} kg</>
                ) : (
                  <>
                    標的：{target.packCount} 包，單件 {target.gramsPerPack} g（總重{" "}
                    {(outputMassKg(target) ?? 0).toFixed(2)} kg）
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

          {/* 指標卡 */}
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

          {/* ===== 依階段（含 Step 明細） + 依係數 Top10 ===== */}
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

      {/* ===== 新增紀錄 Modal ===== */}
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
                placeholder="輸入項目名稱（不影響歷史顯示）"
                value={customMaterialName}
                onChange={(e) => setCustomMaterialName(e.target.value)}
              />

              <Autocomplete
                options={matchedOptions}
                getOptionLabel={(o: any) => o.name}
                isOptionEqualToValue={(o: any, v: any) =>
                  o?.name === v?.name && (o?.unit ?? "") === (v?.unit ?? "")
                }
                renderOption={(props, option: any) => (
                  <li {...props} key={`${option.name}__${option.unit ?? ""}`}>
                    {option.name} {option.unit ? `（${option.unit}）` : ""}
                  </li>
                )}
                onChange={(e, val) => setSelectedMaterial(val)}
                value={selectedMaterial}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="選擇係數（依 Tag 過濾）"
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
                預估碳排量：{(isFinite(emission) ? emission : 0).toFixed(2)} kg
                CO₂e
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
                        {r.unit}（{r.emission} kg）
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

      {/* ===== 標的設定 Modal ===== */}
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
                    setEditingTarget({ ...editingTarget, note: e.target.value })
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

/* Stat cards */
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

/* Modal body primitives */
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
