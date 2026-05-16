// shaders/bbox_init.wgsl — Initialize bounding box accumulators
// For each component slot: minX=MAX, minY=MAX, maxX=0, maxY=0, area=0

struct Uniforms {
  numComponents: u32,
  padding0: u32,
  padding1: u32,
  padding2: u32,
}

// Each component: [minX, minY, maxX, maxY, area, padding, padding, padding]
// Stride = 8 u32 = 32 bytes per component
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read_write> bboxData: array<u32>;

const STRIDE: u32 = 8u;
const U32_MAX: u32 = 0xFFFFFFFFu;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let cid = gid.x;
  if (cid >= uniforms.numComponents) { return; }

  let base = cid * STRIDE;
  bboxData[base + 0u] = U32_MAX; // minX
  bboxData[base + 1u] = U32_MAX; // minY
  bboxData[base + 2u] = 0u;      // maxX
  bboxData[base + 3u] = 0u;      // maxY
  bboxData[base + 4u] = 0u;      // area (pixel count)
  bboxData[base + 5u] = 0u;
  bboxData[base + 6u] = 0u;
  bboxData[base + 7u] = 0u;
}
