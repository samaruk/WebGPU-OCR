/**
 * segmentation/skeleton/endpointDetect.js – locate skeleton endpoints and junctions.
 */
export class EndpointDetect {
  static detect(skeleton, W, H) {
    const endpoints  = [];
    const junctions  = [];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (!skeleton[y * W + x]) continue;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            if ((dy || dx) && skeleton[(y+dy)*W+(x+dx)]) n++;
        if (n === 1) endpoints.push({ x, y });
        if (n >= 3)  junctions.push({ x, y });
      }
    }
    return { endpoints, junctions };
  }
}
