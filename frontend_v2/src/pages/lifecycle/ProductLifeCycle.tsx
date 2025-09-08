import React, { useMemo, useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Autocomplete, TextField } from "@mui/material";
import Modal from "@/ui/components/Modal";
import StageBlock from "@/ui/components/StageBlock";
import HistoryList, { RecordItem } from "@/ui/components/HistoryList";
import { useReport } from "@/context/ReportContext";
import { useUser } from "@/context/UserContext";
import {
  loadProducts,
  loadRecords,
  saveRecords,
  getCurrentShopId,
  loadStageConfig,
  saveStageConfig,
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

const TAB_UNDERLINE = "#8bc84fff";

/** 將舊資料（stage/step 中文）轉成新結構（stageId/stepId/tag/stepLabel） */
function migrateOldRecordsIfNeeded(
  oldRecords: any[],
  cfg: StageConfig[]
): { changed: boolean; records: LifeRecord[] } {
  let changed = false;
  const byTitle: Record<string, StageConfig> = Object.fromEntries(
    cfg.map((s) => [s.title, s])
  );

  const records: LifeRecord[] = (oldRecords || []).map((r: any) => {
    if (r.stageId && r.stepId && r.tag) return r as LifeRecord; // 已是新結構

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

export default function ProductLifeCyclePage() {
  const { productId } = useParams<{ productId: string }>();
  const [searchParams] = useSearchParams();
  const explicitShopId = searchParams.get("shop");
  const navigate = useNavigate();

  const { role } = useUser();
  const readOnly = role === "Consumer"; // 消費者唯讀
  const { exportXlsmByProduct } = useReport();

  const [productName, setProductName] = useState("");
  // 初值放模板，避免空白畫面
  const [stages, setStages] = useState<StageConfig[]>([
    ...FIXED_STAGE_TEMPLATES,
  ]);
  const [records, setRecords] = useState<LifeRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"lifecycle" | "history">(
    "lifecycle"
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStep, setSelectedStep] = useState<{
    stageId: FixedStageId;
    step: UserStep;
  } | null>(null);

  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [inputAmount, setInputAmount] = useState<string>("");
  const [customMaterialName, setCustomMaterialName] = useState("");
  const [showSavedTip, setShowSavedTip] = useState(false);

  const workingShopId = explicitShopId || getCurrentShopId() || "";

  // 掛載讀取（沒有 shopId 也顯示模板）
  useEffect(() => {
    if (!productId) return;

    const shopId = workingShopId;

    // 產品名稱（有 shop 才能載產品）
    if (shopId) {
      const products = loadProducts(shopId);
      const product = products.find(
        (p: any) => String(p.id) === String(productId)
      );
      if (product) setProductName(product.name);
    } else {
      setProductName("");
    }

    // 階段設定（加入防護：空或壞資料就回復模板並寫回）
    let cfg = loadStageConfig(shopId, productId!);
    if (!cfg || !Array.isArray(cfg) || cfg.length === 0) {
      cfg = [...FIXED_STAGE_TEMPLATES];
      if (shopId) saveStageConfig(shopId, productId!, cfg);
    }
    setStages(cfg);

    // 紀錄
    if (shopId) {
      const loaded = loadRecords(productId!, shopId) as any[];
      const migrated = migrateOldRecordsIfNeeded(loaded, cfg);
      if (migrated.changed) {
        setRecords(migrated.records);
        saveRecords(productId!, migrated.records, shopId);
      } else {
        setRecords(loaded as LifeRecord[]);
      }
    } else {
      setRecords([]);
    }
  }, [productId, workingShopId]);

  // 係數選單（用 Tag 比對 + 去除重複 name/unit，避免 MUI key 警告）
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

  // 排放量試算
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

  // 同步驟歷史
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

  // 點擊步驟
  const handleStepClick = (stageId: FixedStageId, step: UserStep) => {
    if (readOnly) return;
    setSelectedStep({ stageId, step });
    setSelectedMaterial(null);
    setInputAmount("");
    setCustomMaterialName("");
    setShowSavedTip(false);
    setModalOpen(true);
  };

  // 新增步驟（名稱＋既有 Tag）
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
      if (workingShopId) saveStageConfig(workingShopId, productId!, next);
      return next;
    });
  };

  /**
   * 線性拖曳重排：在同一個 stage 內，
   * 將 source 直接插入到 target 之前（單純更換順序），**不改變 step 的 tag**。
   */
  const reorderLinear = (stageId: FixedStageId, sourceId: string, targetId: string | null) => {
  if (readOnly) return;
  setStages((prev) => {
    const next = prev.map((s) => {
      if (s.id !== stageId) return s;

      const from = s.steps.findIndex((x) => x.id === sourceId);
      if (from === -1) return s;

      // 先移除來源
      const arr = s.steps.slice();
      const [moved] = arr.splice(from, 1);

      // 計算插入位置（以「移除後」的陣列為基準）
      let to: number;
      if (targetId === null) {
        to = arr.length;                  // 插到最後
      } else {
        to = arr.findIndex((x) => x.id === targetId);
        if (to === -1) return s;          // 找不到目標就不動
      }

      // 直接插入，不要做 from<to 的 -1 調整（因為已經移除過了）
      arr.splice(to, 0, moved);
      return { ...s, steps: arr };
    });

    if (workingShopId) saveStageConfig(workingShopId, productId!, next);
    return next;
  });
};

  // 儲存紀錄
  const handleSaveRecord = () => {
    if (readOnly || !selectedStep) return;

    const amt = parseFloat(inputAmount);
    if (!selectedMaterial || Number.isNaN(amt) || amt <= 0) {
      alert("請選擇係數並輸入用量");
      return;
    }
    const name = (customMaterialName || selectedMaterial.name).trim();
    const nowTs = Math.floor(Date.now() / 1000);

    const newItem: LifeRecord = {
      id: Date.now().toString(),
      productId: productId!,
      stageId: selectedStep.stageId,
      stepId: selectedStep.step.id,
      stepLabel: selectedStep.step.label,
      tag: selectedStep.step.tag, // 關鍵：比對係數/報表都用 Tag
      material: name,
      amount: amt,
      unit: selectedMaterial.unit || "",
      emission: +(parsedCoefficient * amt).toFixed(3),
      timestamp: nowTs,
      date: new Date(nowTs * 1000).toISOString(),
    };

    const next = [...records, newItem];
    setRecords(next);
    if (workingShopId) saveRecords(productId!, next, workingShopId);

    setInputAmount("");
    setSelectedMaterial(null);
    setCustomMaterialName("");
    setShowSavedTip(true);
    setTimeout(() => setShowSavedTip(false), 1200);
  };

  // 匯出
  const handleExport = () => {
    const legacy = records.map((r) => {
      const stageTitle = stages.find((s) => s.id === r.stageId)?.title ?? "";
      return {
        id: r.id,
        productId: r.productId,
        stage: stageTitle,
        step: r.tag, // 步驟名＝既有 Tag
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

  // 返回
  const saveAndReturn = () => {
    if (!readOnly) {
      if (workingShopId) {
        saveRecords(productId!, records, workingShopId);
        saveStageConfig(workingShopId, productId!, stages);
      }
    }
    const suffix = explicitShopId
      ? `?shop=${encodeURIComponent(explicitShopId)}`
      : "";
    navigate("/products" + suffix);
  };

  // HistoryList 仍吃舊結構（以 Tag 群組）
  const legacyStagesForHistory = useMemo(() => {
    return stages.map((s) => ({
      name: s.title,
      steps: Array.from(new Set(s.steps.map((st) => st.tag))),
      extras: [] as string[],
    }));
  }, [stages]);

  return (
    <div style={{ padding: "8px 12px" }}>
      {/* 返回 + 名稱 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <button
          onClick={saveAndReturn}
          aria-label="返回產品列表"
          style={{
            border: "1px solid #ccd6cc",
            background: "#f7fbf7",
            padding: "6px 10px",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          ←
        </button>
        <h2 style={{ margin: 0 }}>
          {productName || "產品"}
          {readOnly && (
            <span style={{ marginLeft: 8, fontSize: 14, color: "#777" }}>
              (檢視模式)
            </span>
          )}
        </h2>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 28,
          marginBottom: 8,
        }}
      >
        <div
          onClick={() => setActiveTab("lifecycle")}
          style={{
            cursor: "pointer",
            fontWeight: activeTab === "lifecycle" ? "bold" : "normal",
            borderBottom:
              activeTab === "lifecycle"
                ? `3.5px solid ${TAB_UNDERLINE}`
                : "none",
            paddingBottom: 4,
          }}
        >
          生命週期
        </div>
        <div
          onClick={() => setActiveTab("history")}
          style={{
            cursor: "pointer",
            fontWeight: activeTab === "history" ? "bold" : "normal",
            borderBottom:
              activeTab === "history" ? `3.5px solid ${TAB_UNDERLINE}` : "none",
            paddingBottom: 4,
          }}
        >
          歷史紀錄
        </div>
      </div>

      {activeTab === "lifecycle" && (
        <>
          {stages.every((s) => s.steps.length === 0) && (
            <div
              style={{
                margin: "8px 12px",
                padding: "10px 12px",
                background: "#fffbe6",
                border: "1px solid #ffe58f",
                borderRadius: 8,
                color: "#614700",
                fontSize: 14,
              }}
            >
              {readOnly
                ? "目前尚未建立任何步驟，請由業者端新增後再查看。"
                : "尚未建立任何步驟，請在各階段按「＋新增步驟」建立（需選既有標籤）。"}
            </div>
          )}
          {stages.map((stage) => (
            <StageBlock
              key={stage.id}
              stage={stage}
              readOnly={readOnly}
              onStepClick={handleStepClick}
              onAddStep={addUserStep}
              onReorderStep={reorderLinear} // ✅ 名稱一致、指向上面那支
            />
          ))}
        </>
      )}

      {activeTab === "history" && (
        <>
          <div style={{ textAlign: "right", marginBottom: 8 }}>
            <button onClick={handleExport}>匯出報表</button>
          </div>
          <HistoryList
            records={
              records.map((r) => ({
                step: r.tag,
                stage: stages.find((s) => s.id === r.stageId)?.title ?? "",
                material: r.material,
                amount: r.amount,
                unit: r.unit,
                emission: r.emission,
                timestamp: r.timestamp ?? 0,
              })) as RecordItem[]
            }
            stages={legacyStagesForHistory as any}
            productId={productId!}
          />
        </>
      )}

      {/* 新增紀錄 Modal */}
      {!readOnly && (
        <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
          {selectedStep && (
            <div style={{ padding: 20 }}>
              <h3>新增碳排放紀錄</h3>
              <h5 style={{ margin: 0 }}>
                階段：
                {stages.find((s) => s.id === selectedStep.stageId)?.title ?? ""}
              </h5>
              <h5 style={{ margin: "4px 0 12px" }}>
                步驟：{selectedStep.step.label}{" "}
                <span style={{ opacity: 0.6 }}>#{selectedStep.step.tag}</span>
              </h5>

              {showSavedTip && (
                <p
                  style={{
                    color: "#2e7d32",
                    background: "rgba(46,125,50,.1)",
                    padding: "6px 10px",
                    borderRadius: 6,
                    fontSize: 13,
                    margin: "6px 0 12px",
                  }}
                >
                  ✅ 已新增！
                </p>
              )}

              <input
                placeholder="輸入項目名稱："
                value={customMaterialName}
                onChange={(e) => setCustomMaterialName(e.target.value)}
                style={{
                  marginBottom: 12,
                  padding: "8px",
                  fontSize: "14px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  width: "100%",
                }}
              />

              <Autocomplete
                options={matchedOptions}
                getOptionLabel={(option: any) => option.name}
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

              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  placeholder="輸入用量"
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: 6,
                    border: "1px solid #ccc",
                  }}
                />
                <span style={{ fontSize: 14, color: "#444" }}>
                  {selectedMaterial?.unit ?? ""}
                </span>
              </div>

              <p style={{ fontSize: 14, color: "#444", marginTop: 8 }}>
                預估碳排量：{(isFinite(emission) ? emission : 0).toFixed(2)} kg
                CO₂e
              </p>

              <div
                style={{
                  margin: "16px 0 8px",
                  padding: "8px 12px",
                  background: "rgba(0,0,0,.04)",
                  borderRadius: 8,
                  maxHeight: 160,
                  overflowY: "auto",
                  fontSize: 13,
                  color: "#444",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  過往紀錄（{samePlaceHistory.length} 筆）
                </div>
                {samePlaceHistory.length === 0 ? (
                  <div style={{ opacity: 0.6 }}>目前無任何紀錄</div>
                ) : (
                  samePlaceHistory.map((r, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "4px 0",
                        borderBottom: "1px solid rgba(0,0,0,.06)",
                      }}
                    >
                      <span>
                        {r.material} × {r.amount}
                        {r.unit}（{r.emission} kg）
                      </span>
                      <span
                        style={{ opacity: 0.6, fontSize: 12, marginLeft: 6 }}
                      >
                        {r.timestamp
                          ? new Date(r.timestamp * 1000).toLocaleString()
                          : ""}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  onClick={handleSaveRecord}
                  style={{
                    background: "#4caf50",
                    color: "#fff",
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  確認提交
                </button>
                <button
                  onClick={() => setModalOpen(false)}
                  style={{
                    background: "#eee",
                    color: "#333",
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
