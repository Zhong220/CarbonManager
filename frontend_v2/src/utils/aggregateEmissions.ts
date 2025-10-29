// src/utils/aggregateEmissions.ts
export type EmissionRecord = {
  id: string;
  stageId: string;
  stageName: string;
  stepId: string;
  stepName: string;
  valueKgCO2e: number;
  ts?: number;
};

export type StepAgg = {
  stepId: string;
  stepName: string;
  total: number;           // 該 step 的總量
  percentOfStage: number;  // 佔該 stage 的比例 0~1
};

export type StageAgg = {
  stageId: string;
  stageName: string;
  total: number;          // 該 stage 的總量
  percent: number;        // 佔全體的比例 0~1
  steps: StepAgg[];
};

export type AggResult = {
  grandTotal: number;     // 全部總量
  byStage: StageAgg[];
};

export function aggregateByStageAndStep(records: EmissionRecord[]): AggResult {
  // 彙總到 stage
  const stageMap = new Map<string, { name: string; total: number; steps: Map<string, { name: string; total: number }> }>();
  let grandTotal = 0;

  for (const r of records) {
    const v = Number(r.valueKgCO2e) || 0;
    grandTotal += v;

    if (!stageMap.has(r.stageId)) {
      stageMap.set(r.stageId, { name: r.stageName || r.stageId, total: 0, steps: new Map() });
    }
    const stage = stageMap.get(r.stageId)!;
    stage.total += v;

    if (!stage.steps.has(r.stepId)) {
      stage.steps.set(r.stepId, { name: r.stepName || r.stepId, total: 0 });
    }
    const step = stage.steps.get(r.stepId)!;
    step.total += v;
  }

  const byStage: StageAgg[] = Array.from(stageMap.entries()).map(([stageId, s]) => {
    const stepsArr: StepAgg[] = Array.from(s.steps.entries())
      .map(([stepId, st]) => ({
        stepId,
        stepName: st.name,
        total: round2(st.total),
        percentOfStage: s.total > 0 ? st.total / s.total : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      stageId,
      stageName: s.name,
      total: round2(s.total),
      percent: grandTotal > 0 ? s.total / grandTotal : 0,
      steps: stepsArr,
    };
  }).sort((a, b) => b.total - a.total);

  return {
    grandTotal: round2(grandTotal),
    byStage,
  };
}

function round2(x: number) {
  return Math.round(x * 100) / 100;
}
