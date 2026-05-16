/**
 * stages/07_swt/swtQualityGate.js
 * Computes SWT reliability score.
 * Score = fraction of foreground pixels with valid (>0) stroke widths.
 * If below swtQualityMin → sets fallback mode in stageGating.
 */
export async function runSWTQualityGate(gpuCtx, swtTex, params) {
  const imageData = await gpuCtx.downloadToImageData(swtTex);
  const { data, width, height } = imageData;
  let valid = 0, total = 0;
  for (let i = 0; i < width * height; i++) {
    const sw = data[i * 4] / 255 * params.swtMaxRayLength; // r channel normalized
    if (data[i * 4 + 3] > 0) {
      total++;
      if (sw > 0.5) valid++;
    }
  }
  const quality = total > 0 ? valid / total : 0;
  const reliable = quality >= params.swtQualityMin;
  if (!reliable) {
    console.warn(`[SWT] Quality gate FAILED: ${(quality * 100).toFixed(1)}% valid (min ${params.swtQualityMin * 100}%). Using fallback mode.`);
  }
  return { quality, reliable };
}
