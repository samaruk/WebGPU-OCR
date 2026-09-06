/* ======================================================================
   DOM HANDLES  ·  every element the app touches, resolved once
   Why: resolving each element a single time at load means no module
   repeats getElementById, and a markup change fails loudly here as one
   broken import rather than silently as scattered nulls.
   ====================================================================== */
export const $ = id => document.getElementById(id);
export const drop=$('drop'), fileInput=$('file'), meta=$('meta');
export const viewCv=$('view'), viewport=$('viewport'), vpEmpty=$('vpEmpty');
export const overlay=$('overlay'), stepLabel=$('oStep'), errBanner=$('errBanner');
export const gpuDot=$('gpuDot'), gpuTxt=$('gpuTxt');
export const runBtn=$('run'), savePng=$('savePng'), saveJson=$('saveJson');
export const stageCap=$('stageCap');

export function showError(message){ errBanner.textContent=message; errBanner.classList.add('show'); }
