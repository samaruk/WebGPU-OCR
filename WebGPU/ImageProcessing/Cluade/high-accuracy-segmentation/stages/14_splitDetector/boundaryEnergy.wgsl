// boundaryEnergy.wgsl
// Samples gradient magnitude along the shared boundary between two component regions.
struct Params { bx1: f32, by1: f32, bx2: f32, by2: f32, width: f32, height: f32, _p0: f32, _p1: f32 }
@group(0) @binding(0) var grayTex: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> energyBuf: array<atomic<u32>>; // fixed-point sum
@group(0) @binding(2) var<uniform> p: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = i32(p.bx1) + i32(gid.x);
  let y = i32(p.by1) + i32(gid.y);
  if (f32(x) > p.bx2 || f32(y) > p.by2) { return; }
  let W = i32(p.width); let H = i32(p.height);
  let gx = textureLoad(grayTex, vec2<i32>(clamp(x+1,0,W-1),y),0).r - textureLoad(grayTex, vec2<i32>(clamp(x-1,0,W-1),y),0).r;
  let gy = textureLoad(grayTex, vec2<i32>(x,clamp(y+1,0,H-1)),0).r - textureLoad(grayTex, vec2<i32>(x,clamp(y-1,0,H-1)),0).r;
  let mag = u32(length(vec2<f32>(gx,gy)) * 1000.0);
  atomicAdd(&energyBuf[0], mag);
}
