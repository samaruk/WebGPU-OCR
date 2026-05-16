// bboxExtract.wgsl
// GPU-side bounding box accumulation per label.
// Computes axis-aligned bbox via atomics; rotated bbox computed on CPU.
struct Params { width: u32, height: u32, _p0: u32, _p1: u32 }
@group(0) @binding(0) var labelTex: texture_2d<u32>;
@group(0) @binding(1) var<storage, read_write> bboxBuf: array<atomic<u32>>; // [id*4: x1,y1,x2,y2]
@group(0) @binding(2) var<uniform> p: Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.width || gid.y >= p.height) { return; }
  let id = textureLoad(labelTex, vec2<i32>(gid.xy), 0).r;
  if (id == 0u || id * 4u + 3u >= arrayLength(&bboxBuf)) { return; }
  atomicMin(&bboxBuf[id*4u+0u], gid.x);    // x1
  atomicMin(&bboxBuf[id*4u+1u], gid.y);    // y1
  atomicMax(&bboxBuf[id*4u+2u], gid.x);    // x2
  atomicMax(&bboxBuf[id*4u+3u], gid.y);    // y2
}
