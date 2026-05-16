// distanceTransform.wgsl — separable 1D EDT approximation
struct Params { width: f32, height: f32, _p0: f32, _p1: f32 }
@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<r32float, write>;
@group(0) @binding(2) var<uniform> p: Params;

@compute @workgroup_size(8, 8)
fn horizontal(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let pos = vec2<i32>(gid.xy);
  let isFg = textureLoad(inputTex, pos, 0).r < 0.5;
  if (!isFg) { textureStore(outputTex, pos, vec4<f32>(9999.0,0.,0.,0.)); return; }
  // Linear scan left and right to find nearest background
  var minDist = f32(W);
  var d = 0;
  loop {
    d++; if (d >= W) { break; }
    let lp = vec2<i32>(clamp(pos.x - d, 0, W-1), pos.y);
    let rp = vec2<i32>(clamp(pos.x + d, 0, W-1), pos.y);
    if (textureLoad(inputTex, lp, 0).r >= 0.5) { minDist = f32(d); break; }
    if (textureLoad(inputTex, rp, 0).r >= 0.5) { minDist = f32(d); break; }
    if (pos.x - d <= 0 && pos.x + d >= W-1) { break; }
  }
  textureStore(outputTex, pos, vec4<f32>(minDist * minDist, 0., 0., 0.));
}

@compute @workgroup_size(8, 8)
fn vertical(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let pos = vec2<i32>(gid.xy);
  let hDist2 = textureLoad(inputTex, pos, 0).r; // squared horizontal dist
  if (hDist2 >= 9998.0) { textureStore(outputTex, pos, vec4<f32>(0.0,0.,0.,0.)); return; }
  var minDist2 = hDist2;
  for (var d = 1; d < H; d++) {
    let up = vec2<i32>(pos.x, clamp(pos.y-d, 0, H-1));
    let dn = vec2<i32>(pos.x, clamp(pos.y+d, 0, H-1));
    let vd2 = f32(d*d);
    let upH = textureLoad(inputTex, up, 0).r;
    let dnH = textureLoad(inputTex, dn, 0).r;
    if (upH < 9998.0) { minDist2 = min(minDist2, upH + vd2); }
    if (dnH < 9998.0) { minDist2 = min(minDist2, dnH + vd2); }
    if (vd2 > minDist2) { break; }
  }
  textureStore(outputTex, pos, vec4<f32>(sqrt(minDist2), 0., 0., 0.));
}
