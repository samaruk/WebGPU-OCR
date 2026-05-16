
// LBP (Local Binary Pattern) texture descriptor
struct Params { width: u32, height: u32 }
@group(0) @binding(0) var<storage, read>       input  : array<f32>;
@group(0) @binding(1) var<storage, read_write> lbp    : array<u32>;
@group(0) @binding(2) var<uniform>             params : Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = i32(gid.x); let y = i32(gid.y);
  if (u32(x) >= params.width || u32(y) >= params.height) { return; }
  let W = i32(params.width); let H = i32(params.height);
  let center = input[u32(y)*u32(W)+u32(x)];
  let offsets = array<vec2i,8>(
    vec2i(-1,-1), vec2i(0,-1), vec2i(1,-1), vec2i(1,0),
    vec2i(1,1),   vec2i(0,1),  vec2i(-1,1), vec2i(-1,0)
  );
  var code = 0u;
  for (var k = 0u; k < 8u; k++) {
    let nx = clamp(x+offsets[k].x, 0, W-1);
    let ny = clamp(y+offsets[k].y, 0, H-1);
    if (input[u32(ny)*u32(W)+u32(nx)] >= center) { code |= (1u << k); }
  }
  lbp[u32(y)*u32(W)+u32(x)] = code;
}
