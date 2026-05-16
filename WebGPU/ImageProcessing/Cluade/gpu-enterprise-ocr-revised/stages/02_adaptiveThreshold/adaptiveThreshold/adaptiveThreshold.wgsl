// Adaptive threshold using box mean from 2D integral image stored in a buffer.
// grayTex is rgba8unorm (filterable) → texture_2d<f32> is valid.
// integralBuf is array<f32> (always valid, no format mismatch possible).

@group(0) @binding(0) var       grayTex    : texture_2d<f32>;
@group(0) @binding(1) var<storage, read>   integralBuf : array<f32>;
@group(0) @binding(2) var       outputTex  : texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> u  : vec4<u32>;
@group(0) @binding(4) var<uniform> uf : vec4<f32>;

fn isum(ix: i32, iy: i32, W: i32, H: i32) -> f32 {
  let cx = clamp(ix, 0, W-1);
  let cy = clamp(iy, 0, H-1);
  return integralBuf[u32(cy) * u32(W) + u32(cx)];
}

fn boxMean(cx: i32, cy: i32, r: i32, W: i32, H: i32) -> f32 {
  let x0 = cx - r - 1; let y0 = cy - r - 1;
  let x1 = cx + r;     let y1 = cy + r;
  let br = isum(x1,y1,W,H); let bl = isum(x0,y1,W,H);
  let tr = isum(x1,y0,W,H); let tl = isum(x0,y0,W,H);
  let ww = f32(min(x1,W-1) - max(x0+1,0) + 1);
  let hh = f32(min(y1,H-1) - max(y0+1,0) + 1);
  return (br - bl - tr + tl) / max(ww * hh, 1.0);
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(u.x); let H = i32(u.y);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let x = i32(gid.x); let y = i32(gid.y);
  let lum = dot(textureLoad(grayTex, vec2<i32>(x,y), 0).rgb,
                vec3<f32>(0.299, 0.587, 0.114));
  let fg = select(0.0, 1.0, lum < boxMean(x, y, i32(u.z), W, H) - uf.x);
  textureStore(outputTex, vec2<i32>(gid.xy), vec4<f32>(fg, fg, fg, 1.0));
}
