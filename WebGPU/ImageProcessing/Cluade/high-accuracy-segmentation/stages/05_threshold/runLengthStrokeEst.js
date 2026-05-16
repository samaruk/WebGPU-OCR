/**
 * stages/05_threshold/runLengthStrokeEst.js
 * Lightweight stroke width estimator using horizontal run-length statistics.
 * Returns median foreground run length ≈ stroke width.
 * Used in Pass 1 → Pass 2 Sauvola bootstrap.
 */
export async function runRunLengthStrokeEst(gpuCtx, binaryTex, registry) {
  // Readback binary texture (small overhead — only called once per image)
  const imageData = await gpuCtx.downloadToImageData(binaryTex);
  const { data, width, height } = imageData;
  const runs = [];

  const sampleStep = Math.max(1, Math.floor(height / 200));
  for (let y = 0; y < height; y += sampleStep) {
    let run = 0; let inRun = false;
    for (let x = 0; x < width; x++) {
      const fg = data[(y * width + x) * 4] < 128; // 0=fg
      if (fg) { run++; inRun = true; }
      else if (inRun) {
        if (run >= 1 && run <= 60) runs.push(run);
        run = 0; inRun = false;
      }
    }
  }

  if (runs.length < 10) return 8; // safe fallback
  runs.sort((a, b) => a - b);
  return runs[Math.floor(runs.length * 0.25)]; // 25th percentile ≈ stroke width
}
