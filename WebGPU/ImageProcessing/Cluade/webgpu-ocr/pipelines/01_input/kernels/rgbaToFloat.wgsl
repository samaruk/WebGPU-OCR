
// Convert RGBA u8 texture → float32 planar storage [R plane, G plane, B plane]
struct Params { width: u32, height: u32 }

@group(0) @binding(0) var<storage, read>       rgba   : array<f32>;  // interleaved RGBA
@group(0) @binding(1) var<storage, read_write> planar : array<f32>;  // R*WH | G*WH | B*WH
@group(0) @binding(2) var<uniform>             params : Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x; let y = gid.y;
  if (x >= params.width || y >= params.height) { return; }
  let i = y * params.width + x;
  let wh = params.width * params.height;
  planar[i]        = rgba[i*4u + 0u]; // R
  planar[i + wh]   = rgba[i*4u + 1u]; // G
  planar[i + wh*2u]= rgba[i*4u + 2u]; // B
}
