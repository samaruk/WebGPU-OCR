// ============================================================
// SIFT-GPU  –  Difference of Gaussians
// DoG[x,y] = G[s+1][x,y] - G[s][x,y]
// ============================================================

struct Params {
  width  : u32,
  height : u32,
  _pad0  : u32,
  _pad1  : u32,
};

@group(0) @binding(0) var<uniform> params   : Params;
@group(0) @binding(1) var fineTex           : texture_2d<f32>;   // blur level s
@group(0) @binding(2) var coarseTex         : texture_2d<f32>;   // blur level s+1
@group(0) @binding(3) var dogOut            : texture_storage_2d<r32float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= params.width || gid.y >= params.height) { return; }
  let coord = vec2<i32>(i32(gid.x), i32(gid.y));
  let dog   = textureLoad(coarseTex, coord, 0).r
            - textureLoad(fineTex,   coord, 0).r;
  textureStore(dogOut, vec2<u32>(gid.x, gid.y), vec4<f32>(dog, 0.0, 0.0, 1.0));
}
