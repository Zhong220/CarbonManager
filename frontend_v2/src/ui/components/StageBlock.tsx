// src/ui/components/StageBlock.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/ui/components/Modal";
import {
  StageConfig,
  FixedStageId,
  UserStep,
  StepTag,
} from "@/utils/lifecycleTypes";
import {
  loadStageConfig,
  saveStageConfig,
  loadRecords,
  saveRecords,
  ensureStepOrderFromSteps,
  saveStepOrder,
  getCurrentShopIdSafe,
  onStageConfigChanged,
  renameStep as storageRenameStep,
  deleteStep as storageDeleteStep,
} from "@/utils/storage";

type ArrowType = "line" | "chevron" | "triangle" | "dashed";
const ARROW_CFG = {
  type: "line" as ArrowType,
  color: "#ffffff",
  stroke: 2,
  opacity: 1,
  head: 4,
  scale: 1.8,
  dash: "3 3",
  offsetY: 0,
};

type Props = {
  stage: StageConfig;
  productId: string;
  readOnly?: boolean;
  onStepClick: (stageId: FixedStageId, step: UserStep) => void;
  onAddStep: (stageId: FixedStageId, label: string, tag: StepTag) => void;
  onReorderStep: (
    stageId: FixedStageId,
    sourceId: string,
    targetId: string | null
  ) => void;
  onRenameStep?: (
    stageId: FixedStageId,
    stepId: string,
    newLabel: string
  ) => void;
  onDeleteStep?: (
    stageId: FixedStageId,
    stepId: string,
    stepLabel: string,
    deleteAlsoRecords: boolean
  ) => void;
};

/** Tag 顯示控制 */
const TAG_MAX_LINES = 2;
const TAG_LINE_HEIGHT = 14;
const TAG_FONT_SIZE = 12;
const TAG_BOX_H = TAG_MAX_LINES * TAG_LINE_HEIGHT;

/* ---------------- helpers：影響筆數、改名、刪除（沿用你的查數邏輯） ---------------- */

function recordMatchStep(
  rec: any,
  stageId: string,
  stepId?: string,
  stepLabel?: string
) {
  const stageOk = rec.stageId ? rec.stageId === stageId : rec.stage === stageId;
  if (!stageOk) return false;
  if (stepId && rec.stepId && rec.stepId === stepId) return true;
  if (stepLabel) return rec.step === stepLabel || rec.stepLabel === stepLabel;
  return false;
}

function countRecordsForStep_storage(
  productId: string,
  shopId: string,
  stageId: string,
  stepId?: string,
  stepLabel?: string
) {
  const records = loadRecords(productId, shopId) || [];
  return records.filter((r: any) =>
    recordMatchStep(r, stageId, stepId, stepLabel)
  ).length;
}

/* ---------------- component ---------------- */

function useViewportFlags() {
  const get = () => {
    if (typeof window === "undefined")
      return { isMobile: false, isTablet: false };
    const w = window.innerWidth;
    return { isMobile: w <= 640, isTablet: w > 640 && w <= 960 };
  };
  const [flags, setFlags] = useState(get);
  useEffect(() => {
    const onResize = () => setFlags(get());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return flags;
}

function useIsTouchLike() {
  const get = () => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia?.("(pointer: coarse)")?.matches ||
      "ontouchstart" in window
    );
  };
  const [v, setV] = useState(get);
  useEffect(() => {
    const onResize = () => setV(get());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return v;
}

/* ---------- 工具：重排陣列 ---------- */
function moveId(list: string[], id: string, beforeId: string | null): string[] {
  const next = list.slice();
  const from = next.indexOf(id);
  if (from === -1) return list;
  next.splice(from, 1);
  if (beforeId == null) next.push(id);
  else {
    const at = next.indexOf(beforeId);
    next.splice(at >= 0 ? at : next.length, 0, id);
  }
  return next;
}

export default function StageBlock({
  stage,
  productId,
  readOnly,
  onStepClick,
  onAddStep,
  onReorderStep,
  onRenameStep,
  onDeleteStep,
}: Props) {
  const { isMobile, isTablet } = useViewportFlags();
  const isTouch = useIsTouchLike();
  const shopId = getCurrentShopIdSafe();

  // ✅ 本地 mirror：不改父層也能即時更新畫面
  const [stageState, setStageState] = useState<StageConfig>(stage);
  // 父層若有更新，仍然同步
  useEffect(() => setStageState(stage), [stage]);

  // 訂閱 storage 廣播：只關注當前 shop + product，抽取對應 stage
  useEffect(() => {
    const off = onStageConfigChanged(({ shopId: sid, productId: pid, cfg }) => {
      if (sid !== shopId || pid !== productId) return;
      const next = cfg.find((s) => s.id === stageState.id);
      if (next) setStageState(next);
    });
    // ✅ 確保回傳的是標準 React cleanup：() => void
    return () => {
      if (typeof off === "function") {
        (off as any)();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, productId, stageState.id]);

  // 初始化排序（用 stageState）
  const initialOrder = useMemo(
    () =>
      ensureStepOrderFromSteps(
        shopId,
        productId,
        stageState.id,
        stageState.steps
      ),
    [shopId, productId, stageState.id, stageState.steps]
  );
  const [orderedIds, setOrderedIds] = useState<string[]>(initialOrder);
  const orderedSteps = useMemo(() => {
    const map = new Map(stageState.steps.map((s) => [s.id, s]));
    return orderedIds.map((id) => map.get(id)).filter(Boolean) as UserStep[];
  }, [stageState.steps, orderedIds]);

  useEffect(() => {
    const aligned = ensureStepOrderFromSteps(
      shopId,
      productId,
      stageState.id,
      stageState.steps
    );
    setOrderedIds(aligned);
  }, [shopId, productId, stageState.id, stageState.steps]);

  /* ----------- 原有狀態保持不動 ----------- */
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("");
  const [tag, setTag] = useState<StepTag>("" as StepTag);
  const [showExtras, setShowExtras] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const [manageMode, setManageMode] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const addPanelRef = useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState<UserStep | null>(null);
  const [newName, setNewName] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteAlsoRecords, setDeleteAlsoRecords] = useState(false);
  const canAdd = !readOnly;

  const S = useMemo(() => {
    if (isMobile)
      return { cardW: 56, cardH: 132, dzW: 18, gap: 8, radius: 16 };
    if (isTablet)
      return { cardW: 64, cardH: 156, dzW: 24, gap: 10, radius: 18 };
    return { cardW: 68, cardH: 168, dzW: 28, gap: 10, radius: 18 };
  }, [isMobile, isTablet]);

  const affectedCount = useMemo(() => {
    if (!editing) return 0;
    return countRecordsForStep_storage(
      productId,
      shopId,
      stageState.id,
      editing.id,
      editing.label
    );
  }, [editing, stageState.id, productId, shopId]);

  // 新增步驟（沿用傳入 callback）
  const handleAdd = () => {
    const name = label.trim();
    if (!name || !tag) return;
    onAddStep(stageState.id as FixedStageId, name, tag);
    setLabel("");
    setTag("" as StepTag);
    setShowAdd(false);
  };

  // ======== 排序寫入邏輯 ========
  const applyNewOrder = (sourceId: string, targetId: string | null) => {
    const next = moveId(orderedIds, sourceId, targetId);
    setOrderedIds(next);
    saveStepOrder(shopId, productId, stageState.id, next);
    onReorderStep?.(stageState.id as FixedStageId, sourceId, targetId);
  };

  /* --------- 以下原本 DnD / 管理模式邏輯保持不變 --------- */

  const setPayload = (ev: React.DragEvent, payload: any) => {
    const txt = JSON.stringify(payload);
    try {
      ev.dataTransfer.setData("text/plain", txt);
      ev.dataTransfer.setData("application/json", txt);
    } catch {}
    ev.dataTransfer.effectAllowed = "move";
  };
  const readPayload = (ev: React.DragEvent) => {
    let raw = "";
    try {
      raw = ev.dataTransfer.getData("text/plain");
    } catch {}
    if (!raw) {
      try {
        raw = ev.dataTransfer.getData("application/json");
      } catch {}
    }
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { stageId: FixedStageId; stepId: string };
    } catch {
      return null;
    }
  };
  const onDragStart = (ev: React.DragEvent, st: UserStep) => {
    if (readOnly || !reorderMode || isTouch) return;
    setPayload(ev, { stageId: stageState.id, stepId: st.id });
  };
  const onDragOverAllow = (ev: React.DragEvent) => {
    if (!reorderMode || isTouch) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = "move";
  };

  const armLongPress = (stepId?: string) => {
    if (readOnly || reorderMode) return;
    longPressTimer.current = window.setTimeout(() => {
      setManageMode(false);
      setReorderMode(true);
      if (isTouch && stepId) setPickedId(stepId);
    }, 350);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const handleContextMenu = (e: React.MouseEvent) => {
    if (readOnly) return;
    e.preventDefault();
    setManageMode(false);
    setReorderMode(true);
  };

  // 行動版：一次選取 → 插入
  const commitPickToTargetIndex = (targetIndex: number) => {
    if (!reorderMode || !pickedId) return;
    const targetId =
      targetIndex >= orderedSteps.length ? null : orderedSteps[targetIndex].id;
    if (targetId === pickedId) {
      setPickedId(null);
      return;
    }
    applyNewOrder(pickedId, targetId);
    setPickedId(null);
  };

  // DropZone
  const DropZone: React.FC<{ index: number }> = ({ index }) => {
    if (!reorderMode) return null;
    const isTail = index === orderedSteps.length;
    const active = hoverIndex === index;

    return (
      <div
        onDragOver={(e) => {
          onDragOverAllow(e);
          setHoverIndex(index);
        }}
        onDragEnter={() => setHoverIndex(index)}
        onDragLeave={() => setHoverIndex((v) => (v === index ? null : v))}
        onDrop={(e) => {
          if (isTouch) return;
          e.preventDefault();
          const payload = readPayload(e);
          setHoverIndex(null);
          if (!payload) return;
          const { stageId, stepId } = payload;
          if (stageId !== stageState.id) return;
          const targetId = isTail ? null : orderedSteps[index]?.id ?? null;
          if (targetId === stepId) return;
          applyNewOrder(stepId, targetId);
        }}
        onClick={() => {
          if (isTouch && pickedId) commitPickToTargetIndex(index);
        }}
        style={{
          width: S.dzW,
          minWidth: S.dzW,
          height: S.cardH + 12 + TAG_BOX_H + 6,
          alignSelf: "stretch",
          borderRadius: 6,
          margin: "0 2px",
          background: active
            ? "rgba(129,199,132,.35)"
            : isTouch && pickedId
            ? "rgba(129,199,132,.12)"
            : "transparent",
          border: active ? "2px dashed #81c784" : "2px dashed transparent",
          transition: "background .12s, border-color .12s",
          boxSizing: "border-box",
          flex: "0 0 auto",
          cursor: reorderMode && isTouch ? "pointer" : "default",
        }}
      />
    );
  };

  // 卡片左右半邊命中
  const onCardDragOver = (
    e: React.DragEvent,
    i: number,
    el: HTMLButtonElement | null
  ) => {
    if (!reorderMode || isTouch) return;
    if (!el) return onDragOverAllow(e);
    onDragOverAllow(e);
    const rect = el.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const index = e.clientX < midX ? i : i + 1;
    if (hoverIndex !== index) setHoverIndex(index);
  };
  const onCardDrop = (
    e: React.DragEvent,
    i: number,
    el: HTMLButtonElement | null
  ) => {
    if (!reorderMode || isTouch) return;
    e.preventDefault();
    const payload = readPayload(e);
    setHoverIndex(null);
    if (!payload) return;
    const { stageId, stepId } = payload;
    if (stageId !== stageState.id) return;
    let targetIndex = i;
    if (el) {
      const rect = el.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      targetIndex = e.clientX < midX ? i : i + 1;
    }
    const targetId =
      targetIndex === orderedSteps.length ? null : orderedSteps[targetIndex].id;
    if (targetId === stepId) return;
    applyNewOrder(stepId, targetId);
  };

  /* ---------- 編輯 / 刪除 ---------- */
  const openEdit = (s: UserStep) => {
    setEditing(s);
    setNewName(s.label);
    setDeleteAlsoRecords(false);
  };
  const closeEdit = () => {
    setEditing(null);
    setConfirmOpen(false);
    setDeleteAlsoRecords(false);
  };
  const doRename = () => {
    if (!editing) return;
    const newLabel = newName.trim();
    if (!newLabel) return;

    if (onRenameStep) {
      onRenameStep(stageState.id, editing.id, newLabel);
    } else {
      // ✅ 使用 storage 內建 rename（會自動同步 step_order 並發事件）
      storageRenameStep(shopId, productId, stageState.id, editing.id, newLabel);
      // onStageConfigChanged 會把畫面推新，不需 reload
    }
    closeEdit();
  };
  const doDelete = () => {
    if (!editing) return;
    if (onDeleteStep) {
      onDeleteStep(
        stageState.id,
        editing.id,
        editing.label,
        deleteAlsoRecords
      );
    } else {
      // ✅ 使用 storage 內建 delete（會同步 order + 發事件）
      storageDeleteStep(shopId, productId, stageState.id, editing.id);
      // 若勾選同時刪除紀錄，額外處理（沿用你原邏輯）
      if (deleteAlsoRecords) {
        const records = loadRecords(productId, shopId) || [];
        const kept = records.filter(
          (r: any) =>
            !recordMatchStep(r, stageState.id, editing.id, editing.label)
        );
        saveRecords(productId, kept, shopId);
      } else {
        const records = loadRecords(productId, shopId) || [];
        const kept = records.map((r: any) => {
          if (
            recordMatchStep(r, stageState.id, editing.id, editing.label)
          ) {
            const mark = " (已刪除的步驟)";
            if (
              typeof r.step === "string" &&
              !String(r.step).includes("已刪除")
            )
              r.step = String(r.step) + mark;
            if (
              typeof r.stepLabel === "string" &&
              !String(r.stepLabel).includes("已刪除")
            )
              r.stepLabel = String(r.stepLabel) + mark;
          }
          return r;
        });
        saveRecords(productId, kept, shopId);
      }
      // onStageConfigChanged 會更新畫面；不需 reload
    }
    closeEdit();
  };

  return (
    <section style={{ padding: isMobile ? "8px 6px" : "10px 8px" }}>
      {/* ===== 標題列 ===== */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "4px 6px 8px",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 3,
            height: 18,
            borderRadius: 2,
            background: "#8bc84f",
          }}
        />
        <h3
          style={{
            margin: 0,
            fontSize: isMobile ? 15 : 16,
            fontWeight: 600,
            letterSpacing: 0.2,
            color: "#2f6b35",
          }}
        >
          {stageState.title}
        </h3>

        {!readOnly && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {/* 管理模式切換 */}
            <button
              type="button"
              onClick={() => {
                // 互斥：開啟管理 → 關閉排序與相關狀態
                if (!manageMode) {
                  setReorderMode(false);
                  setHoverIndex(null);
                  setPickedId(null);
                }
                setManageMode((v) => !v);
              }}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #cbd5c0",
                background: manageMode ? "#2b5a30" : "#fff",
                color: manageMode ? "#fff" : "#2b5a30",
                cursor: "pointer",
              }}
            >
              {manageMode ? "完成管理" : "管理模式"}
            </button>

            <button
              type="button"
              onClick={() => {
                if (reorderMode) {
                  setReorderMode(false);
                  setHoverIndex(null);
                  setPickedId(null);
                } else {
                  // 互斥：開排序前關閉管理
                  setManageMode(false);
                  setReorderMode(true);
                }
              }}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #cbd5c0",
                background: "#fff",
                color: "#2b5a30",
                cursor: "pointer",
              }}
            >
              {reorderMode ? "完成排序" : "排序"}
            </button>

            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px dashed #9cc88a",
                background: "#f7fbf7",
                color: "#2b5a30",
                cursor: "pointer",
              }}
            >
              ＋ 新增步驟
            </button>
          </div>
        )}
      </div>

      {/* 模式說明 */}
      {!readOnly && (
        <div
          style={{
            margin: "0 6px 6px",
            fontSize: 12,
            color: "#2e7d32",
            opacity: reorderMode || manageMode ? 0.95 : 0.7,
          }}
        >
          {manageMode
            ? "管理模式：點擊任何步驟可重新命名或刪除"
            : reorderMode
            ? isTouch
              ? pickedId
                ? "已選取，點擊卡片或虛線區插入位置"
                : "點選要移動的步驟"
              : "拖到綠色虛線或卡片左/右半邊即可插入"
            : isTouch
            ? "長按任一卡片可進入排序模式"
            : "長按或右鍵可進入排序模式"}
        </div>
      )}

      {/* 卡片列 */}
      <div
        style={{
          display: "flex",
          gap: S.gap,
          flexWrap: "nowrap",
          overflowX: "auto",
          padding: "0 6px 4px",
          alignItems: "center",
        }}
      >
        {reorderMode && <DropZone index={0} />}

        {orderedSteps.length === 0 && (
          <div
            style={{
              padding: "6px 0",
              fontSize: 12,
              color: "#879693",
              lineHeight: 1.6,
            }}
          >
            目前尚未建立步驟
          </div>
        )}

        {orderedSteps.map((st, i) => (
          <React.Fragment key={st.id}>
            <CardWithHalfDrop
              step={st}
              index={i}
              readOnly={!!readOnly}
              reorderMode={reorderMode}
              // 管理模式切換
              manageMode={manageMode}
              hoverIndex={hoverIndex}
              onDragStart={onDragStart}
              onCardDragOver={onCardDragOver}
              onCardDrop={onCardDrop}
              onStepClick={onStepClick}
              stageId={stageState.id as FixedStageId}
              armLongPress={() => armLongPress(st.id)}
              cancelLongPress={cancelLongPress}
              handleContextMenu={handleContextMenu}
              size={{ cardW: S.cardW, cardH: S.cardH, radius: S.radius }}
              isTouch={isTouch}
              pickedId={pickedId}
              setPickedId={setPickedId}
              onTapInsertBefore={() => commitPickToTargetIndex(i)}
              showArrowLeft={!reorderMode && i > 0}
              gap={S.gap}
              onOpenEdit={() => openEdit(st)} // 管理模式下會用到
            />
            {reorderMode && i < orderedSteps.length - 1 && (
              <DropZone index={i + 1} />
            )}
          </React.Fragment>
        ))}

        {reorderMode && orderedSteps.length > 0 && (
          <DropZone index={orderedSteps.length} />
        )}
      </div>

      {/* 新增表單（收合） */}
      {canAdd && showAdd && (
        <div
          ref={addPanelRef}
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "1fr"
              : "minmax(180px, 240px) minmax(120px, 200px) auto",
            columnGap: 8,
            rowGap: 8,
            alignItems: "center",
            margin: "8px 6px 0",
            minWidth: 0,
            maxWidth: "100%",
          }}
        >
          <input
            placeholder="步驟名稱"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{
              padding: "10px",
              borderRadius: 8,
              border: "1px solid #a5d6a7",
              background: "#fff",
              width: "100%",
              minWidth: 0,
              boxSizing: "border-box",
            }}
          />
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value as StepTag)}
            style={{
              padding: "10px",
              borderRadius: 8,
              border: "1px solid #a5d6a7",
              background: "#fff",
              width: "100%",
              minWidth: 0,
              boxSizing: "border-box",
            }}
          >
            <option value="" disabled>
              選擇標籤
            </option>
            {(stageState.allowedTags ?? []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!label.trim() || !tag}
            style={{
              background: !label.trim() || !tag ? "#c8e6c9" : "#4caf50",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: isMobile ? "10px 12px" : "8px 12px",
              fontWeight: 700,
              cursor: !label.trim() || !tag ? "not-allowed" : "pointer",
              width: isMobile ? "100%" : "auto",
              whiteSpace: "nowrap",
            }}
          >
            新增
          </button>
        </div>
      )}

      {/* 附加項目開關 + 面板（可選） */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          margin: "8px 6px 0",
        }}
      >
        <button
          onClick={() => setShowExtras((v) => !v)}
          style={{
            background: "transparent",
            border: "none",
            color: "#388e3c",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {showExtras ? "▴ 隱藏附加項目" : "▾ 附加項目"}
        </button>
      </div>

      {showExtras && (
        <div
          style={{
            margin: "6px 6px 0",
            padding: "10px 12px",
            background: "#f1f8e9",
            border: "1px dashed #a5d6a7",
            borderRadius: 8,
            color: "#2e7d32",
          }}
        >
          （這裡可以放「包裝資材／廢棄物／能源資源／運輸」等額外記錄或說明區塊）
        </div>
      )}

      {/* 細分隔線 */}
      <hr
        aria-hidden
        style={{
          border: "none",
          borderTop: "1px solid #e8eee8",
          margin: "10px 0 2px",
        }}
      />

      {/* ====== 編輯步驟 Modal ====== */}
      <Modal open={!!editing} onClose={closeEdit}>
        {editing && (
          <div style={{ display: "grid", gap: 12 }}>
            <h3
              style={{
                margin: "0 0 4px",
                fontSize: 15,
                color: "#2e7d32",
              }}
            >
              編輯步驟
            </h3>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, color: "#2e7d32" }}>步驟名稱</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="輸入新的名稱"
                style={{
                  padding: "10px",
                  borderRadius: 8,
                  border: "1px solid #a5d6a7",
                }}
              />
            </label>

            <div style={{ fontSize: 12, color: "#2e7d32" }}>
              關聯歷史紀錄：<b>{affectedCount}</b> 筆
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={doRename}
                style={{
                  background: "#43a047",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                儲存名稱
              </button>
              <button
                onClick={() => setConfirmOpen(true)}
                style={{
                  background: "#ffeaea",
                  color: "#c62828",
                  border: "1px solid #ffcdd2",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                刪除此步驟…
              </button>
              <button
                onClick={closeEdit}
                style={{
                  background: "#fff",
                  color: "#2e7d32",
                  border: "1px solid #a5d6a7",
                  borderRadius: 8,
                  padding: "8px 12px",
                  cursor: "pointer",
                }}
              >
                取消
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ====== 刪除確認 Modal ====== */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        {editing && (
          <div style={{ display: "grid", gap: 12 }}>
            <h3
              style={{
                margin: "0 0 4px",
                fontSize: 15,
                color: "#c62828",
              }}
            >
              確認刪除步驟
            </h3>
            <div>
              要刪除步驟「<b>{editing.label}</b>」嗎？
            </div>
            <div style={{ fontSize: 12, color: "#2e7d32" }}>
              有 <b>{affectedCount}</b> 筆歷史紀錄屬於此步驟。
            </div>
            <label
              style={{ display: "flex", gap: 8, alignItems: "center" }}
            >
              <input
                type="checkbox"
                checked={deleteAlsoRecords}
                onChange={(e) => setDeleteAlsoRecords(e.target.checked)}
              />
              同時刪除這些歷史紀錄
            </label>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={doDelete}
                style={{
                  background: "#d32f2f",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                確認刪除
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
                style={{
                  background: "#fff",
                  color: "#2e7d32",
                  border: "1px solid #a5d6a7",
                  borderRadius: 8,
                  padding: "8px 12px",
                  cursor: "pointer",
                }}
              >
                返回
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

/** 卡片（保留原本交互；管理模式下點擊即開編輯） */
function CardWithHalfDrop(props: {
  step: UserStep;
  index: number;
  readOnly: boolean;
  reorderMode: boolean;
  manageMode: boolean; // 新增
  hoverIndex: number | null;
  onDragStart: (e: React.DragEvent, st: UserStep) => void;
  onCardDragOver: (
    e: React.DragEvent,
    i: number,
    el: HTMLButtonElement | null
  ) => void;
  onCardDrop: (
    e: React.DragEvent,
    i: number,
    el: HTMLButtonElement | null
  ) => void;
  onStepClick: (stageId: FixedStageId, step: UserStep) => void;
  stageId: FixedStageId;
  armLongPress: (id?: string) => void;
  cancelLongPress: () => void;
  handleContextMenu: (e: React.MouseEvent) => void;
  size: { cardW: number; cardH: number; radius: number };
  isTouch: boolean;
  pickedId: string | null;
  setPickedId: (id: string | null) => void;
  onTapInsertBefore: () => void;
  showArrowLeft?: boolean;
  gap: number;
  onOpenEdit: () => void;
}) {
  const {
    step,
    index,
    readOnly,
    reorderMode,
    manageMode,
    hoverIndex,
    onDragStart,
    onCardDragOver,
    onCardDrop,
    onStepClick,
    stageId,
    armLongPress,
    cancelLongPress,
    handleContextMenu,
    size: S,
    isTouch,
    pickedId,
    setPickedId,
    onTapInsertBefore,
    showArrowLeft,
    gap,
    onOpenEdit,
  } = props;

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const showLeft = hoverIndex === index;
  const showRight = hoverIndex === index + 1;
  const isPicked = pickedId === step.id;

  const ARROW_W = Math.max(8, Math.min(14, gap * ARROW_CFG.scale));
  const arrowSideOffset = -(gap / 2 - ARROW_W / 2);
  const HEAD = Math.min(Math.max(ARROW_CFG.head, 3), 8);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {reorderMode && !isTouch && showLeft && (
        <div
          style={{
            position: "absolute",
            left: -6,
            top: 4,
            bottom: 4,
            width: 4,
            borderRadius: 2,
            background: "#43a047",
          }}
        />
      )}

      <button
        ref={btnRef}
        type="button"
        draggable={!readOnly && reorderMode && !isTouch && !manageMode}
        onDragStart={(e) => onDragStart(e, step)}
        onDragOver={(e) => onCardDragOver(e, index, btnRef.current)}
        onDrop={(e) => onCardDrop(e, index, btnRef.current)}
        onPointerDown={() => armLongPress(step.id)}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onContextMenu={handleContextMenu}
        onClick={() => {
          if (readOnly) return;
          if (manageMode) {
            onOpenEdit(); // 管理模式：直接開編輯
            return;
          }
          if (!reorderMode) {
            onStepClick(stageId, step); // 一般模式：進入 step 詳情
            return;
          }
          if (isTouch) {
            if (pickedId) onTapInsertBefore();
            else setPickedId(step.id);
          }
        }}
        style={{
          width: S.cardW,
          minWidth: S.cardW,
          height: S.cardH,
          borderRadius: S.radius,
          border: manageMode
            ? "2px solid #2b5a30" // 管理模式加強提示
            : isPicked
            ? "2px solid #43a047"
            : "1px solid #a5d6a7",
          background: isPicked
            ? "linear-gradient(180deg, #eaf7ec 0%, #d0ecd2 100%)"
            : "linear-gradient(180deg, #e8f5e9 0%, #c8e6c9 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.45)",
          cursor: readOnly
            ? "default"
            : manageMode
            ? "pointer"
            : reorderMode
            ? isTouch
              ? "pointer"
              : "grab"
            : "pointer",
          padding: "10px 8px",
          writingMode: "vertical-rl" as any,
          textOrientation: "upright" as any,
          fontSize: 14,
          color: "#1b5e20",
          letterSpacing: "2px",
          userSelect: "none",
          touchAction: "none",
          flex: "0 0 auto",
        }}
        aria-label={`step-${step.id}`}
        title={step.label}
      >
        {step.label}
      </button>

      {reorderMode && !isTouch && showRight && (
        <div
          style={{
            position: "absolute",
            right: -6,
            top: 4,
            bottom: 4,
            width: 4,
            borderRadius: 2,
            background: "#43a047",
          }}
        />
      )}

      <div
        title={`#${step.tag}`}
        style={{
          marginTop: 6,
          fontSize: TAG_FONT_SIZE,
          color: "#388e3c",
          maxWidth: S.cardW + 6,
          textAlign: "center",
          padding: "0 2px",
          display: "-webkit-box",
          WebkitLineClamp: TAG_MAX_LINES,
          WebkitBoxOrient: "vertical" as any,
          overflow: "hidden",
          lineHeight: `${TAG_LINE_HEIGHT}px`,
          height: TAG_BOX_H,
          boxSizing: "border-box",
        }}
      >
        #{step.tag}
      </div>

      {/* 左側箭頭（一般模式） */}
      {showArrowLeft && (
        <svg
          width={ARROW_W}
          height={12}
          viewBox={`0 0 ${ARROW_W} 12`}
          style={{
            position: "absolute",
            top: S.cardH / 2 - 6 + ARROW_CFG.offsetY,
            left: arrowSideOffset,
            pointerEvents: "none",
            opacity: ARROW_CFG.opacity,
          }}
        >
          {(() => {
            const c = ARROW_CFG.color;
            const w = ARROW_CFG.stroke;
            const x1 = 1;
            const x2 = ARROW_W - HEAD;
            const tip = ARROW_W - 1;
            switch (ARROW_CFG.type) {
              case "chevron":
                return (
                  <path
                    d={`M ${x2 - 2} 3 L ${tip} 6 L ${x2 - 2} 9`}
                    fill="none"
                    stroke={c}
                    strokeWidth={w}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              case "triangle":
                return (
                  <>
                    <path
                      d={`M ${x1} 6 H ${x2 - 2}`}
                      stroke={c}
                      strokeWidth={w}
                      strokeLinecap="round"
                      fill="none"
                    />
                    <polygon points={`${x2},3 ${tip},6 ${x2},9`} fill={c} />
                  </>
                );
              case "dashed":
                return (
                  <>
                    <path
                      d={`M ${x1} 6 H ${x2}`}
                      stroke={c}
                      strokeWidth={w}
                      strokeLinecap="round"
                      fill="none"
                      strokeDasharray={ARROW_CFG.dash}
                    />
                    <path
                      d={`M ${x2} 3 L ${tip} 6 L ${x2} 9`}
                      fill="none"
                      stroke={c}
                      strokeWidth={w}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </>
                );
              default:
                return (
                  <>
                    <path
                      d={`M ${x1} 6 H ${x2}`}
                      stroke={c}
                      strokeWidth={w}
                      strokeLinecap="round"
                      fill="none"
                    />
                    <path
                      d={`M ${x2} 3 L ${tip} 6 L ${x2} 9`}
                      fill="none"
                      stroke={c}
                      strokeWidth={w}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </>
                );
            }
          })()}
        </svg>
      )}
    </div>
  );
}
