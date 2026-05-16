// shaders/bbox_atomic.wgsl — Atomically accumulate bounding boxes from label map

struct Uniforms {
  width: u32,
  height: u32,
  numComponents: u32,
  padding: u32,
}

const STRIDE: u32 = 8u;

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read>       labels: array<u32>;
@group(0) @binding(2) var<storage, read_write> bboxData: array<atomic<u32>>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = gid.x;
  let y = gid.y;
  if (x >= uniforms.width || y >= uniforms.height) { return; }

  let idx = y * uniforms.width + x;
  let label = labels[idx];
  if (label == 0u || label > uniforms.numComponents) { return; }

  let cid = label - 1u; // 0-based component index
  let base = cid * STRIDE;

  atomicMin(&bboxData[base + 0u], x);            // minX
  atomicMin(&bboxData[base + 1u], y);            // minY
  atomicMax(&bboxData[base + 2u], x);            // maxX
  atomicMax(&bboxData[base + 3u], y);            // maxY
  atomicAdd(&bboxData[base + 4u], 1u);           // area
}
