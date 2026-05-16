// utils/imageLoader.js — Load images from file input or URL

/**
 * Load a File object and return { bitmap, width, height }
 */
export async function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const blob = new Blob([e.target.result], { type: file.type });
        const bitmap = await createImageBitmap(blob);
        resolve({ bitmap, width: bitmap.width, height: bitmap.height });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Load an image from a URL and return { bitmap, width, height }
 */
export async function loadImageURL(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  return { bitmap, width: bitmap.width, height: bitmap.height };
}

/**
 * Render ImageBitmap to a 2D canvas, then return ImageData.
 */
export function bitmapToImageData(bitmap) {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

/**
 * Generate synthetic test images for demos.
 * Returns ImageBitmap.
 */
export async function generateSampleImage(type) {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#111111';

  if (type === 'text1') {
    ctx.font = 'bold 48px serif';
    ctx.fillText('Hello World', 20, 80);
  } else if (type === 'text2') {
    ctx.font = '36px monospace';
    ctx.fillText('segmentation', 10, 70);
  } else if (type === 'digits') {
    ctx.font = 'bold 56px monospace';
    ctx.fillText('0123456789', 8, 90);
  } else if (type === 'mixed') {
    ctx.font = 'bold 40px serif';
    ctx.fillText('OCR Test 123', 10, 65);
    ctx.font = '20px sans-serif';
    ctx.fillText('GPU Segmentation Engine', 10, 100);
  }

  const bitmap = await createImageBitmap(canvas);
  return { bitmap, width: canvas.width, height: canvas.height };
}
