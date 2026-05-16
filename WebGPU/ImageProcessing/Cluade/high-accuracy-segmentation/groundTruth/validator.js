/**
 * groundTruth/validator.js
 * Validates dataset annotation files against the schema.
 */
import schema from "./schema.json" assert { type: "json" };

export function validateDataset(data) {
  const errors = [];

  if (!data.version) errors.push("Missing version field");
  if (!Array.isArray(data.images))      errors.push("images must be an array");
  if (!Array.isArray(data.annotations)) errors.push("annotations must be an array");

  const imageIds = new Set(data.images?.map(i => i.id) ?? []);

  for (const img of data.images ?? []) {
    if (!img.id)     errors.push(`Image missing id: ${JSON.stringify(img)}`);
    if (!img.url)    errors.push(`Image ${img.id}: missing url`);
    if (!img.width || img.width < 1) errors.push(`Image ${img.id}: invalid width`);
    if (!img.height || img.height < 1) errors.push(`Image ${img.id}: invalid height`);
  }

  for (const ann of data.annotations ?? []) {
    if (!ann.id)      errors.push(`Annotation missing id`);
    if (!ann.imageId) errors.push(`Annotation ${ann.id}: missing imageId`);
    if (!imageIds.has(ann.imageId)) errors.push(`Annotation ${ann.id}: imageId ${ann.imageId} not found in images`);
    if (!Array.isArray(ann.bbox) || ann.bbox.length !== 4) {
      errors.push(`Annotation ${ann.id}: bbox must be [x,y,w,h]`);
    } else {
      if (ann.bbox[2] <= 0 || ann.bbox[3] <= 0) errors.push(`Annotation ${ann.id}: bbox width/height must be > 0`);
    }
  }

  return { valid: errors.length === 0, errors };
}
