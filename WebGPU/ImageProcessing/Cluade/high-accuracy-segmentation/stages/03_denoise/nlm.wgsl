// nlm.wgsl — Non-Local Means filter
struct Params { width: f32, height: f32, h: f32, template_r: f32, search_r: f32, _p0: f32, _p1: f32, _p2: f32 }
@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> p: Params;

fn patchDist(a: vec2<i32>, b: vec2<i32>, tr: i32, W: i32, H: i32) -> f32 {
  var dist = 0.0;
  for (var dy = -tr; dy <= tr; dy++) {
    for (var dx = -tr; dx <= tr; dx++) {
      let pa = vec2<i32>(clamp(a.x+dx,0,W-1), clamp(a.y+dy,0,H-1));
      let pb = vec2<i32>(clamp(b.x+dx,0,W-1), clamp(b.y+dy,0,H-1));
      let d  = textureLoad(inputTex,pa,0).rgb - textureLoad(inputTex,pb,0).rgb;
      dist  += dot(d,d);
    }
  }
  return dist / f32((2*tr+1)*(2*tr+1));
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let pos = vec2<i32>(gid.xy);
  let tr = i32(p.template_r); let sr = i32(p.search_r);
  let h2 = p.h * p.h;
  var accColor = vec3<f32>(0.0); var wMax = 0.0; var wSum = 0.0;
  for (var dy = -sr; dy <= sr; dy++) {
    for (var dx = -sr; dx <= sr; dx++) {
      let sp  = vec2<i32>(clamp(pos.x+dx,0,W-1), clamp(pos.y+dy,0,H-1));
      let d   = patchDist(pos, sp, tr, W, H);
      let w   = exp(-max(0.0, d - 0.0) / h2);
      accColor += textureLoad(inputTex,sp,0).rgb * w;
      wSum += w;
      if (w > wMax) { wMax = w; }
    }
  }
  textureStore(outputTex, pos, vec4<f32>(accColor / wSum, 1.0));
}
