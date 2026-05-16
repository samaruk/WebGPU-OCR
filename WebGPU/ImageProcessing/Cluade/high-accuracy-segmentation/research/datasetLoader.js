/**
 * research/datasetLoader.js
 * Loads segmentation datasets from ground truth JSON files.
 * Supports the schema defined in groundTruth/schema.json.
 */
import schema from "../groundTruth/schema.json" assert { type: "json" };

export class DatasetLoader {
  /**
   * Load a ground truth annotation file.
   * @param {string} url - URL to the annotation JSON file
   * @returns {{ images: Array, annotations: Map<string, Array> }}
   */
  static async load(url) {
    const response = await fetch(url);
    const data     = await response.json();
    DatasetLoader.validate(data);
    const annMap = new Map();
    for (const ann of data.annotations) {
      if (!annMap.has(ann.imageId)) annMap.set(ann.imageId, []);
      annMap.get(ann.imageId).push({
        id:    ann.id,
        label: ann.label,
        x1:    ann.bbox[0],
        y1:    ann.bbox[1],
        x2:    ann.bbox[0] + ann.bbox[2],
        y2:    ann.bbox[1] + ann.bbox[3],
      });
    }
    return { images: data.images, annotations: annMap };
  }

  static validate(data) {
    if (!data.images || !Array.isArray(data.images)) throw new Error("Dataset: missing images array");
    if (!data.annotations || !Array.isArray(data.annotations)) throw new Error("Dataset: missing annotations array");
    for (const ann of data.annotations) {
      if (!ann.imageId || !ann.bbox || ann.bbox.length !== 4) {
        throw new Error(`Dataset: invalid annotation: ${JSON.stringify(ann)}`);
      }
    }
  }
}
