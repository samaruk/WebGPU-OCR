// shapeFilter.wgsl — GPU-side label zeroing for rejected components
struct Params { width: u32, height: u32, _p0: u32, _p1: u32 }
@group(0) @binding(0) var inTex: texture_2d<u32>;
@group(0) @binding(1) var<storage, read> rejectedBuf: array<u32>; // 1 = rejected
@group(0) @binding(2) var outTex: texture_storage_2d<r32uint, write>;
@group(0) @binding(3) var<uniform> p: Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.width || gid.y >= p.height) { return; }
  let pos = vec2<i32>(gid.xy);
  let id = textureLoad(inTex, pos, 0).r;
  var out = id;
  if (id > 0u && id < arrayLength(&rejectedBuf) && rejectedBuf[id] == 1u) { out = 0u; }
  textureStore(outTex, pos, vec4<u32>(out, 0u, 0u, 0u));
}
