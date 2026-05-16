// ============================================================
// SIFT-GPU  –  Gaussian Blur  (Vertical pass)
// ============================================================

struct Params {
  width       : u32,
  height      : u32,
  kernelRadius: u32,
  _pad        : u32,
};

@group(0) @binding(0) var<uniform>         params : Params;
@group(0) @binding(1) var<storage, read>   kernel : array<f32>;
@group(0) @binding(2) var inputTex         : texture_2d<f32>;
@group(0) @binding(3) var outputTex        : texture_storage_2d<r32float, write>;

const TILE_H : u32 = 68u;
const WG_W   : u32 = 8u;
const WG_H   : u32 = 8u;

var<workgroup> tile : array<f32, 544>;   // WG_W * TILE_H

@compute @workgroup_size(8, 8)
fn main(
  @builtin(global_invocation_id)   gid  : vec3<u32>,
  @builtin(local_invocation_id)    lid  : vec3<u32>,
  @builtin(workgroup_id)           wgid : vec3<u32>,
) {
  let r         = params.kernelRadius;
  let W         = params.width;
  let H         = params.height;
  let tileTop   = i32(wgid.y * WG_H);
  let tileHeight = WG_H + 2u * r;

  let lx = lid.x;
  var ly = lid.y;
  for (var ty : u32 = ly; ty < tileHeight; ty = ty + WG_H) {
    let imgY = clamp(tileTop + i32(ty) - i32(r), 0, i32(H) - 1);
    let imgX = clamp(i32(gid.x), 0, i32(W) - 1);
    tile[ty * WG_W + lx] = textureLoad(inputTex, vec2<i32>(imgX, imgY), 0).r;
  }
  workgroupBarrier();

  if (gid.x >= W || gid.y >= H) { return; }

  var sum  : f32 = 0.0;
  let tileY = lid.y + r;
  for (var k : u32 = 0u; k <= 2u * r; k++) {
    sum += tile[(tileY - r + k) * WG_W + lx] * kernel[k];
  }

  textureStore(outputTex, vec2<u32>(gid.x, gid.y), vec4<f32>(sum, 0.0, 0.0, 1.0));
}
