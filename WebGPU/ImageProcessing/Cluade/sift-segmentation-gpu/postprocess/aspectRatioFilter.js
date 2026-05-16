/**
 * postprocess/aspectRatioFilter.js – removes implausibly thin/wide segments.
 */
export class AspectRatioFilter {
  static filter(bboxes, { minAspectRatio = 0.05, maxAspectRatio = 20 } = {}) {
    return bboxes.filter(bb => {
      if (bb.w <= 0 || bb.h <= 0) return false;
      const ar = bb.w / bb.h;
      return ar >= minAspectRatio && ar <= maxAspectRatio;
    });
  }
}
