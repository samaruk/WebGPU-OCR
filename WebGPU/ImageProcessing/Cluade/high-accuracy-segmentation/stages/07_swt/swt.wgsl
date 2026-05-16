// swt.wgsl — Stroke Width Transform
// Each foreground pixel fires a ray in the gradient direction.
// Stroke width = distance from pixel to opposite edge.
struct Params {
  width: f32, height: f32, max_ray: f32,
  canny_lo: f32, canny_hi: f32, _p0: f32, _p1: f32, _p2: f32,
}
@group(0) @binding(0) var binaryTex: texture_2d<f32>;
@group(0) @binding(1) var swtOut: texture_storage_2d<r32float, write>;
@group(0) @binding(2) var<uniform> p: Params;

fn grad(pos: vec2<i32>, W: i32, H: i32) -> vec2<f32> {
  let x1 = clamp(pos.x+1,0,W-1); let x0 = clamp(pos.x-1,0,W-1);
  let y1 = clamp(pos.y+1,0,H-1); let y0 = clamp(pos.y-1,0,H-1);
  let gx = textureLoad(binaryTex, vec2<i32>(x1,pos.y),0).r - textureLoad(binaryTex, vec2<i32>(x0,pos.y),0).r;
  let gy = textureLoad(binaryTex, vec2<i32>(pos.x,y1),0).r - textureLoad(binaryTex, vec2<i32>(pos.x,y0),0).r;
  return vec2<f32>(gx, gy);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let pos = vec2<i32>(gid.xy);
  let val = textureLoad(binaryTex, pos, 0).r;
  if (val > 0.5) { // background
    textureStore(swtOut, pos, vec4<f32>(-1.0, 0.0, 0.0, 0.0));
    return;
  }
  // Foreground pixel: fire ray along gradient direction
  let g = grad(pos, W, H);
  let gLen = length(g);
  if (gLen < 0.01) {
    textureStore(swtOut, pos, vec4<f32>(0.0, 0.0, 0.0, 0.0));
    return;
  }
  let dir = normalize(g);
  var strokeWidth = 0.0;
  for (var t = 1; t <= i32(p.max_ray); t++) {
    let tp = vec2<i32>(
      clamp(pos.x + i32(round(f32(t) * dir.x)), 0, W-1),
      clamp(pos.y + i32(round(f32(t) * dir.y)), 0, H-1),
    );
    let tv = textureLoad(binaryTex, tp, 0).r;
    if (tv > 0.5) { // hit background
      strokeWidth = f32(t);
      break;
    }
    // Check for opposite gradient direction (far edge of stroke)
    let tg = grad(tp, W, H);
    if (length(tg) > 0.01 && dot(normalize(tg), dir) < -0.7) {
      strokeWidth = f32(t);
      break;
    }
  }
  textureStore(swtOut, pos, vec4<f32>(strokeWidth, 0.0, 0.0, 0.0));
}
