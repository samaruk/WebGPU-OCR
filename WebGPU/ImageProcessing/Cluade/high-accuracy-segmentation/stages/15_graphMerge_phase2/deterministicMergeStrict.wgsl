// deterministicMergeStrict.wgsl
// Label remap after strict merge decisions — same shader as phase 1
struct Params { width: u32, height: u32, _p0: u32, _p1: u32 }
@group(0) @binding(0) var inLabels: texture_2d<u32>;
@group(0) @binding(1) var<storage, read> mergeTable: array<u32>;
@group(0) @binding(2) var outLabels: texture_storage_2d<r32uint, write>;
@group(0) @binding(3) var<uniform> p: Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.width || gid.y >= p.height) { return; }
  let pos = vec2<i32>(gid.xy);
  let old = textureLoad(inLabels, pos, 0).r;
  var new_ = old;
  if (old > 0u && old < arrayLength(&mergeTable)) { new_ = mergeTable[old]; }
  textureStore(outLabels, pos, vec4<u32>(new_, 0u, 0u, 0u));
}
