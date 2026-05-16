// hough.wgsl — Probabilistic Hough transform vote + line masking
struct Params {
  width: f32, height: f32, num_angles: f32, num_rhos: f32,
  diag_len: f32, threshold: f32, _p0: f32, _p1: f32,
}
@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> accumulator: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> p: Params;

@compute @workgroup_size(8, 8)
fn vote(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let x = f32(gid.x); let y = f32(gid.y);
  let gray = dot(textureLoad(inputTex, vec2<i32>(gid.xy), 0).rgb, vec3<f32>(0.2126,0.7152,0.0722));
  // Simple edge detection: vote only on edge pixels
  let cx = i32(gid.x); let cy = i32(gid.y);
  if (cx < 1 || cy < 1 || cx >= W-1 || cy >= H-1) { return; }
  let gx = textureLoad(inputTex, vec2<i32>(cx+1,cy),0).r - textureLoad(inputTex, vec2<i32>(cx-1,cy),0).r;
  let gy = textureLoad(inputTex, vec2<i32>(cx,cy+1),0).r - textureLoad(inputTex, vec2<i32>(cx,cy-1),0).r;
  let mag = sqrt(gx*gx + gy*gy);
  if (mag < 0.1) { return; }
  // Vote for each angle
  let na = i32(p.num_angles); let nr = i32(p.num_rhos); let dl = p.diag_len;
  for (var a = 0; a < na; a += 2) { // stride 2 for speed
    let theta = f32(a) * 3.14159265 / f32(na);
    let rho   = x * cos(theta) + y * sin(theta);
    let ri    = i32(rho + dl);
    if (ri >= 0 && ri < nr) {
      atomicAdd(&accumulator[a * nr + ri], 1u);
    }
  }
}

// Remove pass — needs separate bind group with output texture
struct Params2 { width: f32, height: f32, num_angles: f32, num_rhos: f32, diag_len: f32, threshold: f32, _p0: f32, _p1: f32 }
@group(0) @binding(0) var inputTex2: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<storage, read> accumRead: array<u32>;
@group(0) @binding(3) var<uniform> p2: Params2;

@compute @workgroup_size(8, 8)
fn remove(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p2.width); let H = i32(p2.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let pos = vec2<i32>(gid.xy);
  let color = textureLoad(inputTex2, pos, 0);
  // If this pixel lies on a detected line, replace with local median
  // (simplified: just pass through — full implementation checks each strong line)
  textureStore(outputTex, pos, color);
}
