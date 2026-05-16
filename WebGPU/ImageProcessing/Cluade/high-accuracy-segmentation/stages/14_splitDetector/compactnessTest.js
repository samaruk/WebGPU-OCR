/**
 * Compactness improvement test.
 * If merging A+B improves combined compactness, it is evidence for merge.
 * Compactness = 4π × area / perimeter².
 * Returns score 0..1: 1 = merge improves compactness.
 */
export async function computeCompactnessTest(compA, compB) {
  const areaA = (compA.x2 - compA.x1) * (compA.y2 - compA.y1);
  const areaB = (compB.x2 - compB.x1) * (compB.y2 - compB.y1);
  const perimA = 2 * ((compA.x2 - compA.x1) + (compA.y2 - compA.y1));
  const perimB = 2 * ((compB.x2 - compB.x1) + (compB.y2 - compB.y1));

  const compactnessA = perimA > 0 ? (4 * Math.PI * areaA) / (perimA * perimA) : 0;
  const compactnessB = perimB > 0 ? (4 * Math.PI * areaB) / (perimB * perimB) : 0;
  const meanBefore   = (compactnessA + compactnessB) / 2;

  // Merged bbox
  const mx1 = Math.min(compA.x1, compB.x1), my1 = Math.min(compA.y1, compB.y1);
  const mx2 = Math.max(compA.x2, compB.x2), my2 = Math.max(compA.y2, compB.y2);
  const areaM  = (mx2 - mx1) * (my2 - my1);
  const perimM = 2 * ((mx2 - mx1) + (my2 - my1));
  const compactnessM = perimM > 0 ? (4 * Math.PI * areaM) / (perimM * perimM) : 0;

  return compactnessM >= meanBefore ? 1.0 : Math.max(0, compactnessM / meanBefore);
}
