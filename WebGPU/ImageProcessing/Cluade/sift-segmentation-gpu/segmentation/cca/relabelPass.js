/**
 * segmentation/cca/relabelPass.js – assigns final consecutive IDs after merge.
 */
export function relabel(components, mergedIds) {
  const idMap = new Map();
  let next    = 0;
  for (const id of mergedIds) {
    if (!idMap.has(id)) idMap.set(id, next++);
  }
  return components
    .filter(c => idMap.has(c.id))
    .map(c => ({ ...c, id: idMap.get(c.id) }));
}
