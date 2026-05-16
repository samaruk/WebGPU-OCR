/**
 * research/benchmarking.js
 * End-to-end benchmark runner. Processes a dataset and reports metrics.
 */
import { DatasetLoader } from "./datasetLoader.js";
import { computeF1, computeSplitMergeErrors } from "./metrics.js";
import { PerStageMetrics } from "./perStageMetrics.js";

export class Benchmarker {
  constructor(pipelineRunner) {
    this.pipeline = pipelineRunner;
    this.results  = [];
  }

  async run(datasetUrl, options = {}) {
    const { iouThreshold = 0.5 } = options;
    const { images, annotations } = await DatasetLoader.load(datasetUrl);
    console.log(`Benchmarking on ${images.length} images...`);

    for (const image of images) {
      const t0     = performance.now();
      const bboxes = await this.pipeline.runOnImage(image.url);
      const gt     = annotations.get(image.id) ?? [];
      const elapsed = performance.now() - t0;

      const { f1, precision, recall, tp, fp, fn } = computeF1(bboxes, gt, iouThreshold);
      const { splitErrors, mergeErrors } = computeSplitMergeErrors(bboxes, gt, iouThreshold * 0.6);

      this.results.push({
        imageId: image.id, f1, precision, recall, tp, fp, fn,
        splitErrors, mergeErrors, elapsed,
        predicted: bboxes.length, gt: gt.length,
      });

      console.log(`[${image.id}] F1=${f1.toFixed(3)} split=${splitErrors} merge=${mergeErrors} ${elapsed.toFixed(0)}ms`);
    }

    return this.summary();
  }

  summary() {
    const n = this.results.length;
    if (n === 0) return {};
    const avg = key => this.results.reduce((s,r) => s + r[key], 0) / n;
    return {
      imageCount:   n,
      meanF1:       avg("f1"),
      meanPrecision: avg("precision"),
      meanRecall:   avg("recall"),
      totalSplitErrors:  this.results.reduce((s,r) => s + r.splitErrors, 0),
      totalMergeErrors:  this.results.reduce((s,r) => s + r.mergeErrors, 0),
      meanElapsedMs: avg("elapsed"),
      perImage: this.results,
    };
  }

  toCSV() {
    const headers = "imageId,f1,precision,recall,split_errors,merge_errors,elapsed_ms";
    const rows = this.results.map(r =>
      `${r.imageId},${r.f1.toFixed(4)},${r.precision.toFixed(4)},${r.recall.toFixed(4)},${r.splitErrors},${r.mergeErrors},${r.elapsed.toFixed(1)}`
    );
    return [headers, ...rows].join("\n");
  }
}
