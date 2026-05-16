/**
 * segmentation/cca/flattenLabels.js – remap component IDs to a dense 0..N-1 range.
 */
export function flattenLabels(labels, components) {
  const remap = new Map();
  components.forEach((c, i) => remap.set(c.id, i));

  const flat = new Int32Array(labels.length).fill(-1);
  for (let i = 0; i < labels.length; i++) {
    const id = labels[i];
    if (remap.has(id)) flat[i] = remap.get(id);
  }
  return flat;
}
