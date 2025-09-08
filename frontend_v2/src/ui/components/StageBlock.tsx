import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  StageConfig,
  FixedStageId,
  UserStep,
  StepTag,
} from "@/utils/lifecycleTypes";

/** Arrow 外觀設定 */
type ArrowType = "line" | "chevron" | "triangle" | "dashed";

const ARROW_CFG = {
  type: "line" as ArrowType, // "line" | "chevron" | "triangle" | "dashed"
  color: "#ffffffff", // 顏色
  stroke: 2, // 線條粗細(px)
  opacity: 1, // 透明度 0~1
  head: 4, // 箭頭頭部長度(px)（line/dashed/triangle 用）
  scale: 1.8, // 箭頭相對 gap 的比例（1=剛好置中；>1 更長）
  dash: "3 3", // 只在 dashed 模式使用：虛線樣式
  offsetY: 0, // 垂直微調（px，正數往下）
};

type Props = {
  stage: StageConfig;
  readOnly?: boolean;
  onStepClick: (stageId: FixedStageId, step: UserStep) => void;
  onAddStep: (stageId: FixedStageId, label: string, tag: StepTag) => void;
  /** 線性重排：把 sourceId 插到 targetId 之前；targetId 為 null 代表插到最後 */
  onReorderStep: (
    stageId: FixedStageId,
    sourceId: string,
    targetId: string | null
  ) => void;
};

/** Tag 顯示控制（固定高度，避免卡片高低不一） */
const TAG_MAX_LINES = 2;
const TAG_LINE_HEIGHT = 14; // px
const TAG_FONT_SIZE = 12; // px
const TAG_BOX_H = TAG_MAX_LINES * TAG_LINE_HEIGHT;

/** Viewport 偵測（SSR 安全） */
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

/** 觸控環境判定（行動裝置） */
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

export default function StageBlock({
  stage,
  readOnly,
  onStepClick,
  onAddStep,
  onReorderStep,
}: Props) {
  const { isMobile, isTablet } = useViewportFlags();
  const isTouch = useIsTouchLike();

  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("");
  const [tag, setTag] = useState<StepTag>("");
  const [showExtras, setShowExtras] = useState(false);

  // 排序模式（長按或右鍵開啟）
  const [reorderMode, setReorderMode] = useState(false);
  const longPressTimer = useRef<number | null>(null);

  // 目前命中的插入索引（介於 0..N），例如 0=最前面、N=最後面
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // 行動版後備：選取中的來源 stepId（tap 選取 → tap 目標）
  const [pickedId, setPickedId] = useState<string | null>(null);

  // 新增表單區塊（手機開啟時自動捲到可視）
  const addPanelRef = useRef<HTMLDivElement | null>(null);

  const canAdd = !readOnly;

  // 視覺尺寸
  const S = useMemo(() => {
    if (isMobile) {
      return {
        cardW: 56,
        cardH: 132,
        dzW: 18,
        gap: 8,
        radius: 16,
        leftBarW: 56,
      };
    }
    if (isTablet) {
      return {
        cardW: 64,
        cardH: 156,
        dzW: 24,
        gap: 10,
        radius: 18,
        leftBarW: 66,
      };
    }
    return {
      cardW: 68,
      cardH: 168,
      dzW: 28,
      gap: 10,
      radius: 18,
      leftBarW: 72,
    };
  }, [isMobile, isTablet]);

  // 線性渲染
  const flatSteps = useMemo(() => stage.steps, [stage.steps]);

  // ========== 新增步驟 ==========
  const handleAdd = () => {
    const name = label.trim();
    if (!name || !tag) return;
    onAddStep(stage.id as FixedStageId, name, tag);
    setLabel("");
    setTag("");
    setShowAdd(false);
  };

  useEffect(() => {
    if (isMobile && showAdd && addPanelRef.current) {
      addPanelRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [isMobile, showAdd]);

  // ========== DnD 基礎（桌機） ==========
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
    if (readOnly || !reorderMode || isTouch) return; // 觸控環境不使用原生 DnD
    setPayload(ev, { stageId: stage.id, stepId: st.id });
  };

  const onDragOverAllow = (ev: React.DragEvent) => {
    if (!reorderMode || isTouch) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = "move";
  };

  // ========== 進入/離開排序模式 ==========
  const armLongPress = (stepId?: string) => {
    if (readOnly || reorderMode) return;
    longPressTimer.current = window.setTimeout(() => {
      setReorderMode(true);
      // 行動版：長按直接選取來源
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
    setReorderMode(true);
  };

  // ========== 行動版後備：執行一次「選取來源 → 插入目標」 ==========
  const commitPickToTargetIndex = (targetIndex: number) => {
    if (!reorderMode || !pickedId) return;
    const targetId =
      targetIndex >= flatSteps.length ? null : flatSteps[targetIndex].id;
    if (targetId === pickedId) {
      setPickedId(null);
      return;
    }
    onReorderStep(stage.id, pickedId, targetId);
    setPickedId(null);
  };

  // ========== Drop Zone ==========
  const DropZone: React.FC<{ index: number }> = ({ index }) => {
    if (!reorderMode) return null;
    const isTail = index === flatSteps.length;
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
          if (isTouch) return; // 行動交互用點選
          e.preventDefault();
          const payload = readPayload(e);
          setHoverIndex(null);
          if (!payload) return;
          const { stageId, stepId } = payload;
          if (stageId !== stage.id) return; // 僅限同 stage
          const targetId = isTail ? null : flatSteps[index]?.id ?? null;
          if (targetId === stepId) return;
          onReorderStep(stage.id, stepId, targetId);
        }}
        onClick={() => {
          if (isTouch && pickedId) commitPickToTargetIndex(index);
        }}
        style={{
          width: S.dzW,
          minWidth: S.dzW,
          // 與卡片等高（包含 tag 區）
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
        aria-label={isTail ? "drop-tail" : "drop-between"}
      />
    );
  };

  // ========== 卡片左右半邊命中（桌機 DnD） ==========
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
    if (stageId !== stage.id) return;

    let targetIndex = i;
    if (el) {
      const rect = el.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      targetIndex = e.clientX < midX ? i : i + 1;
    }
    const targetId =
      targetIndex === flatSteps.length ? null : flatSteps[targetIndex].id;
    if (targetId === stepId) return;
    onReorderStep(stage.id, stepId, targetId);
  };

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 18,
        padding: 0,
        margin: isMobile ? 10 : 12,
        border: "1px solid #cde5cd",
        boxShadow: "0 2px 8px rgba(0,0,0,.06)",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "stretch" }}>
        {/* 左側縱向標籤 */}
        <div
          style={{
            width: S.leftBarW,
            background: "#e8f5e9",
            borderRight: "1px solid #cde5cd",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            writingMode: "vertical-rl" as any,
            textOrientation: "mixed" as any,
            fontWeight: 700,
            color: "#2e7d32",
            letterSpacing: "2px",
            fontSize: isMobile ? 13 : 14,
            flex: "0 0 auto",
          }}
        >
          {stage.title}
        </div>

        {/* 右側內容 */}
        <div
          style={{
            flex: 1,
            padding: "14px 16px 12px 16px",
            overflowX: "hidden",
          }}
        >
          {!readOnly && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#2e7d32",
                  opacity: reorderMode ? 1 : 0.7,
                }}
              >
                {reorderMode
                  ? isTouch
                    ? pickedId
                      ? "選取中，可點選至指定位置："
                      : "點選要移動的步驟"
                    : "拖到綠色虛線或卡片的左/右半邊即可插入"
                  : isTouch
                  ? "長按任一卡片進入排序模式"
                  : "長按或右鍵進入排序模式"}
              </div>
              {reorderMode && (
                <button
                  onClick={() => {
                    setReorderMode(false);
                    setHoverIndex(null);
                    setPickedId(null);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    height: isMobile ? 28 : 30,
                    padding: isMobile ? "0 10px" : "0 12px",
                    fontSize: isMobile ? 12 : 13,
                    lineHeight: 1,
                    background: "#a5d6a7",
                    border: "1px solid #81c784",
                    borderRadius: 999,
                    color: "#1b5e20",
                    cursor: "pointer",
                  }}
                  title="完成排序"
                >
                  完成
                </button>
              )}
            </div>
          )}

          {/* 卡片列 */}
          <div
            style={{
              display: "flex",
              gap: S.gap,
              flexWrap: "nowrap",
              overflowX: "auto",
              paddingBottom: 4,
              alignItems: "center",
            }}
          >
            {/* 只有排序模式才顯示頭部 DropZone */}
            {reorderMode && <DropZone index={0} />}

            {flatSteps.length === 0 && (
              <div style={{ opacity: 0.6, padding: "6px 2px" }}>
                目前尚未建立步驟
              </div>
            )}

            {flatSteps.map((st, i) => (
              <React.Fragment key={st.id}>
                <CardWithHalfDrop
                  step={st}
                  index={i}
                  readOnly={!!readOnly}
                  reorderMode={reorderMode}
                  hoverIndex={hoverIndex}
                  onDragStart={onDragStart}
                  onCardDragOver={onCardDragOver}
                  onCardDrop={onCardDrop}
                  onStepClick={onStepClick}
                  stageId={stage.id}
                  armLongPress={() => armLongPress(st.id)}
                  cancelLongPress={cancelLongPress}
                  handleContextMenu={handleContextMenu}
                  size={S}
                  isTouch={isTouch}
                  pickedId={pickedId}
                  setPickedId={setPickedId}
                  onTapInsertBefore={() => commitPickToTargetIndex(i)}
                  /* ✅ 平常顯示箭頭（左側）；排序模式隱藏；第 0 張沒有箭頭 */
                  showArrowLeft={!reorderMode && i > 0}
                  gap={S.gap}
                />

                {/* 只有排序模式才插入中間 DropZone */}
                {reorderMode && i < flatSteps.length - 1 && (
                  <DropZone index={i + 1} />
                )}
              </React.Fragment>
            ))}

            {/* 只有排序模式才顯示尾端 DropZone */}
            {reorderMode && flatSteps.length > 0 && (
              <DropZone index={flatSteps.length} />
            )}
          </div>

          {/* 新增 & 附加 */}
          <div
            ref={addPanelRef}
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "auto 1fr auto",
              alignItems: "center",
              columnGap: 8,
              rowGap: 8,
              marginTop: 10,
              maxWidth: "100%",
            }}
          >
            {canAdd ? (
              <>
                {/* 觸發按鈕：固定尺寸，不撐滿 */}
                <button
                  onClick={() => setShowAdd((v) => !v)}
                  style={{
                    border: "1px solid #81c784",
                    background: "#e8f5e9",
                    padding: isMobile ? "8px 12px" : "6px 10px",
                    borderRadius: 8,
                    cursor: "pointer",
                    color: "#2e7d32",
                    fontSize: isMobile ? 14 : 13,
                    fontWeight: 600,
                    justifySelf: "start",
                  }}
                >
                  {showAdd ? "關閉" : "＋新增步驟"}
                </button>

                {/* 表單：手機直式堆疊，所有欄位都不超出容器 */}
                {showAdd && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile
                        ? "1fr"
                        : "minmax(180px, 240px) minmax(120px, 200px) auto",
                      columnGap: 8,
                      rowGap: 8,
                      alignItems: "center",
                      gridColumn: isMobile ? "1 / -1" : "2 / 3",
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
                        background: "#ffffff",
                        width: "100%",
                        minWidth: 0,
                        boxSizing: "border-box",
                      }}
                    />
                    <select
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                      style={{
                        padding: "10px",
                        borderRadius: 8,
                        border: "1px solid #a5d6a7",
                        background: "#ffffff",
                        width: "100%",
                        minWidth: 0,
                        boxSizing: "border-box",
                      }}
                    >
                      <option value="" disabled>
                        選擇標籤
                      </option>
                      {(stage.allowedTags ?? []).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAdd}
                      disabled={!label.trim() || !tag}
                      style={{
                        background:
                          !label.trim() || !tag ? "#c8e6c9" : "#4caf50",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: isMobile ? "10px 12px" : "8px 12px",
                        fontWeight: 700,
                        cursor:
                          !label.trim() || !tag ? "not-allowed" : "pointer",
                        width: isMobile ? "100%" : "auto",
                        whiteSpace: "nowrap",
                      }}
                    >
                      新增
                    </button>
                  </div>
                )}
              </>
            ) : (
              <span />
            )}

            {/* 附加項目開關：手機放在最右、自然換行 */}
            <button
              onClick={() => setShowExtras((v) => !v)}
              style={{
                background: "transparent",
                border: "none",
                color: "#388e3c",
                cursor: "pointer",
                justifySelf: "end",
                whiteSpace: "nowrap",
              }}
            >
              {showExtras ? "▴ 隱藏附加項目" : "▾ 附加項目"}
            </button>
          </div>

          {showExtras && (
            <div
              style={{
                marginTop: 8,
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
        </div>
      </div>
    </div>
  );
}

/** 卡片（桌機：拖曳；手機：點選排序） */
function CardWithHalfDrop(props: {
  step: UserStep;
  index: number;
  readOnly: boolean;
  reorderMode: boolean;
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
  /** 左側箭頭（僅一般模式） */
  showArrowLeft?: boolean;
  /** 外層 gap（用來計算箭頭位置） */
  gap: number;
}) {
  const {
    step,
    index,
    readOnly,
    reorderMode,
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
  } = props;

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const showLeft = hoverIndex === index;
  const showRight = hoverIndex === index + 1;
  const isPicked = pickedId === step.id;

  // 箭頭寬度：依 gap 與 scale 調整，最低 8px 最高 14px；置中到兩卡之間
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
      {/* 左側指示線（桌機拖曳預視） */}
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
        draggable={!readOnly && reorderMode && !isTouch}
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
          if (!reorderMode) {
            onStepClick(stageId, step);
            return;
          }
          // 排序模式下（行動）：已選取來源 → 點此卡 = 插到此卡之前；否則選取此卡為來源
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
          border: isPicked ? "2px solid #43a047" : "1px solid #a5d6a7",
          background: isPicked
            ? "linear-gradient(180deg, #eaf7ec 0%, #d0ecd2 100%)"
            : "linear-gradient(180deg, #e8f5e9 0%, #c8e6c9 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.45)",
          cursor: readOnly
            ? "default"
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

      {/* 右側指示線（桌機拖曳預視） */}
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

      {/* Tag：兩行夾斷 + 固定高度，所有卡片等高 */}
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

      {/* ✅ 左側箭頭（一般模式顯示；排序模式隱藏；第 0 張沒有） */}
      {showArrowLeft && (
        <svg
          width={ARROW_W}
          height={12}
          viewBox={`0 0 ${ARROW_W} 12`}
          style={{
            position: "absolute",
            top: S.cardH / 2 - 6 + ARROW_CFG.offsetY,
            left: arrowSideOffset, // 放在左邊 gap 中央
            pointerEvents: "none",
            opacity: ARROW_CFG.opacity,
          }}
        >
          {(() => {
            const c = ARROW_CFG.color;
            const w = ARROW_CFG.stroke;
            const x1 = 1;
            const x2 = ARROW_W - HEAD; // 箭頭頭部開始位置
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
              default: // "line"
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
