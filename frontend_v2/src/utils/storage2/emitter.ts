// src/utils/storage/emitter.ts
import type { StageConfig } from "./types";

export type StageCfgChangedPayload = { shopId: string; productId: string; cfg: StageConfig[] };
export type StepOrderChangedPayload = { shopId: string; productId: string; stageId: string; order: string[] };

type BusMap = {
  "stagecfg:changed": StageCfgChangedPayload;
  "steporder:changed": StepOrderChangedPayload;
};
type BusHandler<K extends keyof BusMap> = (p: BusMap[K]) => void;

const map = new Map<string, Set<Function>>();

export const Emitter = {
  on<K extends keyof BusMap>(type: K, fn: BusHandler<K>) {
    if (!map.has(type)) map.set(type, new Set());
    map.get(type)!.add(fn);
    return () => map.get(type)?.delete(fn);
  },
  emit<K extends keyof BusMap>(type: K, payload: BusMap[K]) {
    const set = map.get(type);
    if (!set) return;
    for (const fn of set) (fn as any)(payload);
  },
};

export const onStageConfigChanged = (fn: BusHandler<"stagecfg:changed">) =>
  Emitter.on("stagecfg:changed", fn);

export const onStepOrderChanged = (fn: BusHandler<"steporder:changed">) =>
  Emitter.on("steporder:changed", fn);
