/**
 * research/perStageMetrics.js
 * Per-stage intermediate IoU to isolate degradation point in pipeline.
 * Attach to each stage output to track where accuracy drops.
 */
import { computeF1 } from "./metrics.js";

export class PerStageMetrics {
  constructor() { this._records = []; }

  /**
   * Record metrics for a pipeline stage.
   * @param {string} stageName
   * @param {Array}  predictedBoxes
   * @param {Array}  gtBoxes
   * @param {number} iouThreshold
   */
  record(stageName, predictedBoxes, gtBoxes, iouThreshold = 0.5) {
    const result = computeF1(predictedBoxes, gtBoxes, iouThreshold);
    this._records.push({ stage: stageName, ...result, timestamp: performance.now() });
    console.log(`[Metrics:${stageName}] F1=${result.f1.toFixed(3)} P=${result.precision.toFixed(3)} R=${result.recall.toFixed(3)}`);
  }

  /** Returns the stage with the largest F1 drop vs previous stage. */
  findWorstDropStage() {
    let worst = null, worstDrop = 0;
    for (let i = 1; i < this._records.length; i++) {
      const drop = this._records[i-1].f1 - this._records[i].f1;
      if (drop > worstDrop) { worstDrop = drop; worst = this._records[i].stage; }
    }
    return { stage: worst, drop: worstDrop };
  }

  summary() { return this._records; }

  toCSV() {
    const header = "stage,f1,precision,recall,tp,fp,fn";
    const rows   = this._records.map(r =>
      `${r.stage},${r.f1.toFixed(4)},${r.precision.toFixed(4)},${r.recall.toFixed(4)},${r.tp},${r.fp},${r.fn}`
    );
    return [header, ...rows].join("\n");
  }
}
