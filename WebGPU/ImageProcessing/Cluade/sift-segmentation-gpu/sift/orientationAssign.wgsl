// sift/orientationAssign.wgsl – GPU orientation histogram kernel (reference)
struct KP { x: f32, y: f32, octave: u32, scale: u32, sigma: f32, response: f32, orientation: f32, _pad: f32 }
@group(0) @binding(0) var<storage, read>       keypoints : array<KP>;
@group(0) @binding(1) var<storage, read_write> output    : array<KP>;
@group(0) @binding(2) var grayTex : texture_2d<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let idx = gid.x;
  if (idx >= arrayLength(&keypoints)) { return; }
  let kp    = keypoints[idx];
  let sigma = kp.sigma;
  let r     = i32(ceil(3.0 * sigma));
  let W     = i32(textureDimensions(grayTex).x);
  let H     = i32(textureDimensions(grayTex).y);
  var hist : array<f32, 36>;

  for (var dy = -r; dy <= r; dy++) {
    for (var dx = -r; dx <= r; dx++) {
      let nx = i32(kp.x) + dx;
      let ny = i32(kp.y) + dy;
      if (nx < 1 || ny < 1 || nx >= W-1 || ny >= H-1) { continue; }
      let gx = textureLoad(grayTex, vec2<i32>(nx+1, ny), 0).r - textureLoad(grayTex, vec2<i32>(nx-1, ny), 0).r;
      let gy = textureLoad(grayTex, vec2<i32>(nx, ny+1), 0).r - textureLoad(grayTex, vec2<i32>(nx, ny-1), 0).r;
      let mag = sqrt(gx*gx + gy*gy);
      let ang = atan2(gy, gx);
      let w   = exp(-f32(dx*dx + dy*dy) / (2.0 * pow(1.5*sigma, 2.0)));
      let bin = u32((ang + 3.14159265) / (2.0*3.14159265) * 36.0) % 36u;
      hist[bin] += mag * w;
    }
  }

  var maxV = 0.0;
  for (var b = 0u; b < 36u; b++) { if (hist[b] > maxV) { maxV = hist[b]; } }
  var bestBin = 0u;
  for (var b = 0u; b < 36u; b++) { if (hist[b] == maxV) { bestBin = b; } }
  var out = kp;
  out.orientation = (f32(bestBin) + 0.5) / 36.0 * 2.0 * 3.14159265 - 3.14159265;
  output[idx] = out;
}
