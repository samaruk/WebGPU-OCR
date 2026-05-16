// skeletonAngleContinuity.wgsl
// Computes gradient direction histogram in each component region.
struct Params { width: f32, height: f32, _p0: f32, _p1: f32 }
@group(0) @binding(0) var binaryTex: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> angleHist: array<atomic<u32>>; // 36 bins × 2 comps
@group(0) @binding(2) var<uniform> p: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let pos = vec2<i32>(gid.xy);
  let v = textureLoad(binaryTex, pos, 0).r;
  if (v > 0.5) { return; }
  let gx = textureLoad(binaryTex, vec2<i32>(clamp(pos.x+1,0,W-1),pos.y),0).r
          - textureLoad(binaryTex, vec2<i32>(clamp(pos.x-1,0,W-1),pos.y),0).r;
  let gy = textureLoad(binaryTex, vec2<i32>(pos.x,clamp(pos.y+1,0,H-1)),0).r
          - textureLoad(binaryTex, vec2<i32>(pos.x,clamp(pos.y-1,0,H-1)),0).r;
  let angle = atan2(gy, gx);
  let bin   = u32((angle + 3.14159) / (2.0 * 3.14159) * 36.0) % 36u;
  atomicAdd(&angleHist[bin], 1u);
}
