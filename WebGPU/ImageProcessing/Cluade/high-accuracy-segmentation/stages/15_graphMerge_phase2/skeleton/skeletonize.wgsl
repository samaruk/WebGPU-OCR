// skeletonize.wgsl — Zhang-Suen thinning, one sub-iteration
struct Params { width: f32, height: f32, _p0: f32, _p1: f32 }
@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> p: Params;

fn P(tex: texture_2d<f32>, x: i32, y: i32, W: i32, H: i32) -> f32 {
  return textureLoad(tex, vec2<i32>(clamp(x,0,W-1), clamp(y,0,H-1)), 0).r;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let x = i32(gid.x); let y = i32(gid.y);
  let c = P(inputTex, x, y, W, H);
  if (c > 0.5) { textureStore(outputTex, vec2<i32>(gid.xy), vec4<f32>(c,c,c,1.)); return; }
  // 8-neighbors in order: N, NE, E, SE, S, SW, W, NW
  let p2 = P(inputTex, x, y-1, W, H) < 0.5;
  let p3 = P(inputTex, x+1, y-1, W, H) < 0.5;
  let p4 = P(inputTex, x+1, y, W, H) < 0.5;
  let p5 = P(inputTex, x+1, y+1, W, H) < 0.5;
  let p6 = P(inputTex, x, y+1, W, H) < 0.5;
  let p7 = P(inputTex, x-1, y+1, W, H) < 0.5;
  let p8 = P(inputTex, x-1, y, W, H) < 0.5;
  let p9 = P(inputTex, x-1, y-1, W, H) < 0.5;
  let B = u32(p2)+u32(p3)+u32(p4)+u32(p5)+u32(p6)+u32(p7)+u32(p8)+u32(p9);
  var transitions = 0u;
  if (!p2 && p3) { transitions++; } if (!p3 && p4) { transitions++; }
  if (!p4 && p5) { transitions++; } if (!p5 && p6) { transitions++; }
  if (!p6 && p7) { transitions++; } if (!p7 && p8) { transitions++; }
  if (!p8 && p9) { transitions++; } if (!p9 && p2) { transitions++; }
  var keep = c;
  if (B >= 2u && B <= 6u && transitions == 1u && (!p2 || !p4 || !p6) && (!p4 || !p6 || !p8)) {
    keep = 1.0; // mark for deletion
  }
  textureStore(outputTex, vec2<i32>(gid.xy), vec4<f32>(keep,keep,keep,1.));
}
