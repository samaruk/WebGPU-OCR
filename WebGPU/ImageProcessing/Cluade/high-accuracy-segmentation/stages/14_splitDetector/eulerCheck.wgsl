// eulerCheck.wgsl
// Computes Euler number per component region via 2×2 quad pattern lookup.
// Euler = Σ pattern_weight / 4 (standard formula)
struct Params { x1: f32, y1: f32, x2: f32, y2: f32, width: f32, height: f32, _p0: f32, _p1: f32 }
@group(0) @binding(0) var binaryTex: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> eulerBuf: array<atomic<i32>>;
@group(0) @binding(2) var<uniform> p: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = i32(p.x1) + i32(gid.x);
  let y = i32(p.y1) + i32(gid.y);
  if (f32(x) >= p.x2 || f32(y) >= p.y2) { return; }
  let W = i32(p.width); let H = i32(p.height);
  let q00 = textureLoad(binaryTex, vec2<i32>(x,   y  ), 0).r < 0.5;
  let q10 = textureLoad(binaryTex, vec2<i32>(clamp(x+1,0,W-1), y  ), 0).r < 0.5;
  let q01 = textureLoad(binaryTex, vec2<i32>(x,   clamp(y+1,0,H-1)), 0).r < 0.5;
  let q11 = textureLoad(binaryTex, vec2<i32>(clamp(x+1,0,W-1), clamp(y+1,0,H-1)), 0).r < 0.5;
  let pattern = u32(q00) | (u32(q10) << 1u) | (u32(q01) << 2u) | (u32(q11) << 3u);
  // Euler contribution lookup table (standard 2×2 quad Euler number table)
  var contrib = 0i;
  switch (pattern) {
    case 1u, 2u, 4u, 8u:    { contrib =  1i; }
    case 3u, 5u, 6u, 9u, 10u, 12u: { contrib = 0i; }
    case 7u, 11u, 13u, 14u: { contrib = -1i; }
    case 15u:                { contrib =  0i; }
    default:                 { contrib =  0i; }
  }
  atomicAdd(&eulerBuf[0], contrib);
}
