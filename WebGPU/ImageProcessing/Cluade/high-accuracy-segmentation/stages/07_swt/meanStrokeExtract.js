/**
 * stages/07_swt/meanStrokeExtract.js
 * Computes mean and std-dev stroke width from SWT map.
 * Writes results to StrokeWidthStore — the pipeline-global source of truth.
 */
export async function runMeanStrokeExtract(gpuCtx, swtTex, swtQuality, sws, registry) {
  const imageData = await gpuCtx.downloadToImageData(swtTex);
  const { data, width, height } = imageData;

  const values = [];
  for (let i = 0; i < width * height; i++) {
    // r32float packed into rgba8 — extract raw value from red channel
    const sw = data[i * 4] / 255 * 200; // rough denormalization for r32float→rgba8
    if (sw > 0.5 && sw < 100) values.push(sw);
  }

  if (values.length === 0) {
    sws.write({ meanStrokeWidth: 8, strokeWidthStdDev: 2, swtTexture: swtTex, swtQuality: 0, fallbackMode: true });
    return;
  }

  values.sort((a, b) => a - b);
  // Use median rather than mean — robust to outliers from noise
  const median = values[Math.floor(values.length * 0.5)];
  // Trim to IQR before computing mean
  const q1 = values[Math.floor(values.length * 0.25)];
  const q3 = values[Math.floor(values.length * 0.75)];
  const trimmed = values.filter(v => v >= q1 && v <= q3);
  const mean = trimmed.reduce((s, v) => s + v, 0) / trimmed.length;
  const variance = trimmed.reduce((s, v) => s + (v - mean) ** 2, 0) / trimmed.length;
  const stdDev = Math.sqrt(variance);

  sws.write({
    meanStrokeWidth:   mean,
    strokeWidthStdDev: stdDev,
    swtTexture:        swtTex,
    swtQuality:        swtQuality.quality,
    fallbackMode:      !swtQuality.reliable,
  });

  console.log(`[SWT] mean=${mean.toFixed(2)}px  σ=${stdDev.toFixed(2)}  quality=${(swtQuality.quality*100).toFixed(1)}%`);
}
