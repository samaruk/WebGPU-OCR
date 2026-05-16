
struct Params { srcW: u32, srcH: u32, dstW: u32, dstH: u32 }
@group(0) @binding(0) var<storage, read>       src    : array<f32>;
@group(0) @binding(1) var<storage, read_write> dst    : array<f32>;
@group(0) @binding(2) var<storage, read>       Hinv   : array<f32>;  // 9 floats row-major 3x3
@group(0) @binding(3) var<uniform>             params : Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dx = f32(gid.x); let dy = f32(gid.y);
  if (u32(dx) >= params.dstW || u32(dy) >= params.dstH) { return; }
  // Apply inverse homography: [sx,sy,sw] = Hinv * [dx,dy,1]
  let h = Hinv;
  let sw = h[6]*dx + h[7]*dy + h[8];
  let sx = (h[0]*dx + h[1]*dy + h[2]) / sw;
  let sy = (h[3]*dx + h[4]*dy + h[5]) / sw;
  let sxi = i32(round(sx)); let syi = i32(round(sy));
  var val = 1.0;
  if (sxi>=0 && syi>=0 && u32(sxi)<params.srcW && u32(syi)<params.srcH) {
    val = src[u32(syi)*params.srcW+u32(sxi)];
  }
  dst[u32(dy)*params.dstW+u32(dx)] = val;
}
