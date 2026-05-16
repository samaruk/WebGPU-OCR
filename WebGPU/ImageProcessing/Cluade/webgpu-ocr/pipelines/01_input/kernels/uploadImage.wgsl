
// Upload raw RGBA u8 image pixels → f32 storage buffer [0..1]
struct Params { width: u32, height: u32 }

@group(0) @binding(0) var<storage, read>       srcU8  : array<u32>;   // packed RGBA bytes
@group(0) @binding(1) var<storage, read_write> dstF32 : array<f32>;   // R,G,B,A floats
@group(0) @binding(2) var<uniform>             params : Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x; let y = gid.y;
  if (x >= params.width || y >= params.height) { return; }

  let pix = srcU8[y * params.width + x];        // packed u32 RGBA
  let r = f32((pix      ) & 0xFFu) / 255.0;
  let g = f32((pix >>  8u) & 0xFFu) / 255.0;
  let b = f32((pix >> 16u) & 0xFFu) / 255.0;
  let a = f32((pix >> 24u) & 0xFFu) / 255.0;

  let base = (y * params.width + x) * 4u;
  dstF32[base + 0u] = r;
  dstF32[base + 1u] = g;
  dstF32[base + 2u] = b;
  dstF32[base + 3u] = a;
}
