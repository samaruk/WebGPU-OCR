
struct Params { srcW: u32, srcH: u32, dstW: u32, dstH: u32, channels: u32 }
@group(0) @binding(0) var<storage, read>       src    : array<f32>;
@group(0) @binding(1) var<storage, read_write> dst    : array<f32>;
@group(0) @binding(2) var<uniform>             params : Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dx = gid.x; let dy = gid.y;
  if (dx >= params.dstW || dy >= params.dstH) { return; }

  let sx_f = (f32(dx) + 0.5) * f32(params.srcW) / f32(params.dstW) - 0.5;
  let sy_f = (f32(dy) + 0.5) * f32(params.srcH) / f32(params.dstH) - 0.5;

  let sx0 = u32(max(0.0, floor(sx_f)));
  let sy0 = u32(max(0.0, floor(sy_f)));
  let sx1 = min(sx0 + 1u, params.srcW - 1u);
  let sy1 = min(sy0 + 1u, params.srcH - 1u);
  let wx  = sx_f - floor(sx_f);
  let wy  = sy_f - floor(sy_f);

  let C = params.channels;
  let di = (dy * params.dstW + dx) * C;

  for (var c = 0u; c < C; c++) {
    let v00 = src[(sy0 * params.srcW + sx0) * C + c];
    let v01 = src[(sy0 * params.srcW + sx1) * C + c];
    let v10 = src[(sy1 * params.srcW + sx0) * C + c];
    let v11 = src[(sy1 * params.srcW + sx1) * C + c];
    let top = mix(v00, v01, wx);
    let bot = mix(v10, v11, wx);
    dst[di + c] = mix(top, bot, wy);
  }
}
