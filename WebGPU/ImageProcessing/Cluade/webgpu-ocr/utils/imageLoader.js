// Load image file -> HTMLImageElement / ImageData

/**
 * Load a File or Blob as an HTMLImageElement.
 */
export function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Convert HTMLImageElement to RGBA Float32 array [0..1]
 * Optionally resize to targetW x targetH.
 */
export function imageToRGBAFloat(img, targetW, targetH) {
  const W = targetW ?? img.naturalWidth;
  const H = targetH ?? img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, W, H);
  const raw = ctx.getImageData(0, 0, W, H).data;   // Uint8ClampedArray RGBA
  const out = new Float32Array(W * H * 4);
  for (let i = 0; i < W * H * 4; i++) out[i] = raw[i] / 255;
  return { data: out, width: W, height: H };
}

/**
 * Draw Float32 RGBA [0..1] array to a canvas.
 */
export function drawFloat32RGBA(data, W, H, canvas) {
  canvas.width = W; canvas.height = H;
  const ctx  = canvas.getContext('2d');
  const img  = ctx.createImageData(W, H);
  const raw  = img.data;
  for (let i = 0; i < W * H; i++) {
    raw[i*4+0] = Math.round(clamp(data[i*4+0], 0, 1) * 255);
    raw[i*4+1] = Math.round(clamp(data[i*4+1], 0, 1) * 255);
    raw[i*4+2] = Math.round(clamp(data[i*4+2], 0, 1) * 255);
    raw[i*4+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }
