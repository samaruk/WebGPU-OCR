// shaders/jfa_init.wgsl
// Seed the JFA: for each white (background) pixel write its own coord;
// for black (foreground) pixel write a sentinel (0xFFFF, 0xFFFF).

struct Params { width: u32, height: u32 }

@group(0) @binding(0) var threshold_tex: texture_2d<f32>;
// ping-pong RG16 texture: each pixel stores nearest seed (x,y) as u16 pair
// We use rgba16uint for storage
@group(0) @binding(1) var seed_out: texture_storage_2d<rgba16uint, write>;
@group(0) @binding(2) var<uniform> p: Params;

const SENTINEL: u32 = 0xFFFFu;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.width || gid.y >= p.height) { return; }
  let v = textureLoad(threshold_tex, vec2<i32>(gid.xy), 0).r;
  // v == 0 => foreground (text) → it IS a seed for distance transform
  // v == 1 => background  → no seed, sentinel
  if (v < 0.5) {
    // foreground: seed = self
    textureStore(seed_out, vec2<i32>(gid.xy),
      vec4<u32>(gid.x, gid.y, 0u, 0u));
  } else {
    textureStore(seed_out, vec2<i32>(gid.xy),
      vec4<u32>(SENTINEL, SENTINEL, 0u, 0u));
  }
}
