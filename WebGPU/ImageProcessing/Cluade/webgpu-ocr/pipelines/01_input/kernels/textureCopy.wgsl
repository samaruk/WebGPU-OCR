
// Copy a region of a float32 RGBA buffer to another buffer (with optional flip)
struct Params { srcW: u32, srcH: u32, dstW: u32, dstH: u32, flipY: u32 }

@group(0) @binding(0) var<storage, read>       src    : array<f32>;
@group(0) @binding(1) var<storage, read_write> dst    : array<f32>;
@group(0) @binding(2) var<uniform>             params : Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dx = gid.x; let dy = gid.y;
  if (dx >= params.dstW || dy >= params.dstH) { return; }

  // Map destination pixel → source pixel (nearest)
  let sx = u32(f32(dx) * f32(params.srcW) / f32(params.dstW));
  var sy = u32(f32(dy) * f32(params.srcH) / f32(params.dstH));
  if (params.flipY != 0u) { sy = params.srcH - 1u - sy; }
  sy = min(sy, params.srcH - 1u);

  let si = (sy * params.srcW + sx) * 4u;
  let di = (dy * params.dstW + dx) * 4u;
  dst[di]   = src[si];
  dst[di+1u]= src[si+1u];
  dst[di+2u]= src[si+2u];
  dst[di+3u]= src[si+3u];
}
