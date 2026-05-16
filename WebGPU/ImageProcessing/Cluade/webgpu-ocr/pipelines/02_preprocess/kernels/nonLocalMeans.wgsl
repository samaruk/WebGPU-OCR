
struct Params {
  width: u32, height: u32,
  searchWin: u32, patchSize: u32,
  h: f32,
}
@group(0) @binding(0) var<storage, read>       input  : array<f32>;
@group(0) @binding(1) var<storage, read_write> output : array<f32>;
@group(0) @binding(2) var<uniform>             params : Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x; let y = gid.y;
  if (x >= params.width || y >= params.height) { return; }

  let W = i32(params.width); let H = i32(params.height);
  let sw  = i32(params.searchWin)  / 2;
  let ps  = i32(params.patchSize)  / 2;
  let h2  = params.h * params.h;

  var sumW = 0.0; var sumVal = 0.0;

  for (var sy = -sw; sy <= sw; sy++) {
    for (var sx = -sw; sx <= sw; sx++) {
      // Patch distance
      var dist = 0.0; var cnt = 0.0;
      for (var py = -ps; py <= ps; py++) {
        for (var px = -ps; px <= ps; px++) {
          let ax = clamp(i32(x)+px,    0, W-1);
          let ay = clamp(i32(y)+py,    0, H-1);
          let bx = clamp(i32(x)+sx+px, 0, W-1);
          let by = clamp(i32(y)+sy+py, 0, H-1);
          let d  = input[u32(ay)*u32(W)+u32(ax)] - input[u32(by)*u32(W)+u32(bx)];
          dist += d*d; cnt += 1.0;
        }
      }
      dist /= max(cnt, 1.0);
      let w = exp(-max(dist - 0.0, 0.0) / h2);
      let nx2 = clamp(i32(x)+sx, 0, W-1);
      let ny2 = clamp(i32(y)+sy, 0, H-1);
      sumVal += input[u32(ny2)*u32(W)+u32(nx2)] * w;
      sumW   += w;
    }
  }
  output[y*params.width+x] = sumVal / max(sumW, 1e-8);
}
