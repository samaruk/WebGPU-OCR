// JFA final: compute Euclidean distance, write to storage buffer.
// Writing to array<f32> storage buffer instead of r32float texture
// eliminates the texture_2d<f32> + unfilterable-float mismatch in downstream consumers.

@group(0) @binding(0) var<storage, read> seedX   : array<u32>;
@group(0) @binding(1) var<storage, read> seedY   : array<u32>;
@group(0) @binding(2) var<storage, read_write> distBuf : array<f32>;
@group(0) @binding(3) var<uniform> dims : vec4<u32>;

const EMPTY : u32 = 0xFFFFFFFFu;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = dims.x; let H = dims.y;
  if (gid.x >= W || gid.y >= H) { return; }
  let idx = gid.y * W + gid.x;
  let sx  = seedX[idx];
  let sy  = seedY[idx];
  var dist = 0.0f;
  if (sx != EMPTY) {
    let ddx = f32(gid.x) - f32(sx);
    let ddy = f32(gid.y) - f32(sy);
    dist = sqrt(ddx*ddx + ddy*ddy);
  }
  distBuf[idx] = dist;
}
