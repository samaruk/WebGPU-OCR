@group(0) @binding(0) var<storage,read> swtIn : array<u32>;
@group(0) @binding(1) var outputTex : texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> u : vec4<u32>;

const NO_STROKE : u32 = 0xFFFFFFFFu;  // sentinel: buffer cell never written by raytrace

fn swtAt(x:i32, y:i32, W:i32, H:i32) -> f32 {
  if (x<0 || y<0 || x>=W || y>=H) { return 0.0; }
  let v = swtIn[u32(y)*u32(W) + u32(x)];
  if (v == NO_STROKE || v == 0u) { return 0.0; }   // 0u = old compat, 0xFFFFFFFF = new sentinel
  return bitcast<f32>(v);
}

@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(u.x); let H = i32(u.y);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let maxSW = f32(u.z);

  var vals : array<f32, 9>; var k = 0;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      vals[k] = swtAt(i32(gid.x)+dx, i32(gid.y)+dy, W, H); k++;
    }
  }
  for (var i = 0; i < 9; i++) {
    for (var j = i+1; j < 9; j++) {
      if (vals[j] < vals[i]) { let t=vals[i]; vals[i]=vals[j]; vals[j]=t; }
    }
  }
  let sw = vals[4];
  if (sw <= 0.0) {
    textureStore(outputTex, vec2<i32>(gid.xy), vec4<f32>(0.0, 0.0, 0.0, 1.0));
    return;
  }
  // Yellow (thin) → orange → red (thick)
  let norm = clamp(sw / maxSW, 0.0, 1.0);
  textureStore(outputTex, vec2<i32>(gid.xy), vec4<f32>(1.0, 1.0-norm, 0.0, 1.0));
}
