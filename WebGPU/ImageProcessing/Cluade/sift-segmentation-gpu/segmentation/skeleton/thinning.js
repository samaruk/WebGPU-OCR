/**
 * segmentation/skeleton/thinning.js – Zhang-Suen morphological thinning (CPU).
 */
export class Thinning {
  static run(binary, W, H) {
    const img = new Uint8Array(binary);
    let changed = true;
    while (changed) {
      changed = false;
      for (let pass = 0; pass < 2; pass++) {
        const del = [];
        for (let y = 1; y < H - 1; y++) {
          for (let x = 1; x < W - 1; x++) {
            if (!img[y * W + x]) continue;
            const p = zhangSuenNeighbors(img, x, y, W);
            if (zhangSuenCondition(p, pass)) { del.push(y * W + x); }
          }
        }
        for (const i of del) { img[i] = 0; changed = true; }
      }
    }
    return img;
  }
}

function zhangSuenNeighbors(img, x, y, W) {
  return [
    img[    (y-1)*W + x   ],
    img[    (y-1)*W + x+1 ],
    img[    y*W    + x+1  ],
    img[    (y+1)*W + x+1 ],
    img[    (y+1)*W + x   ],
    img[    (y+1)*W + x-1 ],
    img[    y*W    + x-1  ],
    img[    (y-1)*W + x-1 ],
  ].map(v => v ? 1 : 0);
}

function zhangSuenCondition(p, pass) {
  const n = p.reduce((s, v) => s + v, 0);
  if (n < 2 || n > 6) return false;
  let trans = 0;
  for (let i = 0; i < 7; i++) if (!p[i] && p[i+1]) trans++;
  if (!p[7] && p[0]) trans++;
  if (trans !== 1) return false;
  if (pass === 0) return !(p[0] && p[2] && p[4]) && !(p[2] && p[4] && p[6]);
  return !(p[0] && p[2] && p[6]) && !(p[0] && p[4] && p[6]);
}
