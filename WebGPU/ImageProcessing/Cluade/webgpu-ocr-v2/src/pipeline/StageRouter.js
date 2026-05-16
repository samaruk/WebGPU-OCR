// Routes execution: skips stages based on document type + region properties
export class StageRouter {
  constructor(config) { this.config = config; }

  /** Decide whether to run PARSeq (vs CRNN) for a given crop */
  shouldUsePARSeq(crop) {
    if (!crop) return false;
    const ar = crop.width / Math.max(1, crop.height);
    return (
      ar > 8 ||                            // very wide → likely curved
      crop.confidence < 0.7 ||             // low CRNN confidence
      crop.strokeWidth < 2 ||              // thin strokes → likely handwriting
      (crop.label === "handwriting")
    );
  }

  /** Decide whether to run language model on a text result */
  shouldRunLM(text, confidence) {
    if (!text || text.length < 2) return false;
    if (confidence >= this.config.recognition.skipLMMinConfidence) return false;
    if (this.config.recognition.skipLMForNumerics && /^[\d.,\s%$€£¥]+$/.test(text)) return false;
    return true;
  }

  /** Decide which detection backbone based on image quality */
  selectBackbone(imageWidth, imageHeight, qualityScore) {
    if (imageWidth > 2000 || imageHeight > 2000) return "resnet50";
    if (qualityScore < 0.5) return "mobilenetv3";   // fast path for blurry
    return this.config.detection.backbone;
  }
}