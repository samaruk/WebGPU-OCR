// ============================================================
// SIFT-GPU  –  Gaussian Blur  (Horizontal pass)
// Separable 1-D convolution along X using a pre-baked kernel.
// Workgroup: 8x8 threads + shared memory tile for cache efficiency.
// ============================================================

struct Params {
  width       : u32,
  height      : u32,
  kernelRadius: u32,
  _pad        : u32,
};

@group(0) @binding(0) var<uniform>         params : Params;
@group(0) @binding(1) var<storage, read>   kernel : array<f32>;   // 2*r+1 weights
@group(0) @binding(2) var inputTex         : texture_2d<f32>;
@group(0) @binding(3) var outputTex        : texture_storage_2d<r32float, write>;

// Shared tile: (8 + 2*MAX_RADIUS) * 8 floats
// MAX_RADIUS = ceil(3 * sigma_max).  sigma_max ~ 10 -> r=30, tile=68*8=544
const TILE_W : u32 = 68u;  // 8 + 2*30  (generous upper bound)
const WG_W   : u32 = 8u;
const WG_H   : u32 = 8u;

var<workgroup> tile : array<f32, 544>;   // TILE_W * WG_H

@compute @workgroup_size(8, 8)
fn main(
  @builtin(global_invocation_id)   gid  : vec3<u32>,
  @builtin(local_invocation_id)    lid  : vec3<u32>,
  @builtin(workgroup_id)           wgid : vec3<u32>,
) {
  let r      = params.kernelRadius;
  let W      = params.width;
  let H      = params.height;

  // Centre of tile in image-space x
  let tileLeft = i32(wgid.x * WG_W);

  // Each thread loads (tile_width / WG_W) + 1 pixels into shared memory
  let tileWidth = WG_W + 2u * r;
  var lx = lid.x;
  let ly = lid.y;
  // Load left halo + core + right halo
  for (var tx : u32 = lx; tx < tileWidth; tx = tx + WG_W) {
    let imgX = clamp(tileLeft + i32(tx) - i32(r), 0, i32(W) - 1);
    let imgY = clamp(i32(gid.y), 0, i32(H) - 1);
    tile[ly * tileWidth + tx] = textureLoad(inputTex, vec2<i32>(imgX, imgY), 0).r;
  }
  workgroupBarrier();

  // Guard: out-of-bounds threads exit after populating shared memory
  if (gid.x >= W || gid.y >= H) { return; }

  // Convolve
  var sum : f32 = 0.0;
  let tileX = lid.x + r;   // centre in tile coords
  for (var k : u32 = 0u; k <= 2u * r; k++) {
    sum += tile[ly * tileWidth + tileX - r + k] * kernel[k];
  }

  textureStore(outputTex, vec2<u32>(gid.x, gid.y), vec4<f32>(sum, 0.0, 0.0, 1.0));
}
