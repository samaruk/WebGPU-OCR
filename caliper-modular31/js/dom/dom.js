/* ======================================================================
   DOM HANDLES  ·  every element the app touches, resolved once
   Why: resolving each element a single time at load means no module repeats
   getElementById, and a markup change fails loudly here as one broken import
   rather than silently as scattered nulls. showError lives here because it
   only needs the error-banner element and nothing else.
   ====================================================================== */
/* ---------- DOM ---------- */
export const $ = id => document.getElementById(id);
export const drop=$('drop'), fileIn=$('file'), meta=$('meta');
export const viewCv=$('view'), viewport=$('viewport'), vpEmpty=$('vpEmpty');
export const overlay=$('overlay'), oStep=$('oStep'), errBanner=$('errBanner');
export const gpuDot=$('gpuDot'), gpuTxt=$('gpuTxt');
export const runBtn=$('run'), savePng=$('savePng'), saveJson=$('saveJson');
export const stageCap=$('stageCap'), legendEl=$('legend');


export function showError(msg){ errBanner.textContent=msg; errBanner.classList.add('show'); }
