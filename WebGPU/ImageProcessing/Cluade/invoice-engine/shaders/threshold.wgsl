// shaders/threshold.wgsl — Gaussian-weighted adaptive threshold (box approximation via 3-pass)

struct Params {
  width: u32,
  height: u32,
  block_half: u32,  // half of block size
  C: f32,           // constant subtracted from mean
}

@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var dst: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let w = params.width;
  let h = params.height;
  if (gid.x >= w || gid.y >= h) { return; }

  let cx = i32(gid.x);
  let cy = i32(gid.y);
  let r  = i32(params.block_half);

  // Compute local mean in block_half window
  var sum: f32 = 0.0;
  var count: f32 = 0.0;
  for (var dy: i32 = -r; dy <= r; dy++) {
    for (var dx: i32 = -r; dx <= r; dx++) {
      let nx = clamp(cx + dx, 0, i32(w) - 1);
      let ny = clamp(cy + dy, 0, i32(h) - 1);
      sum += textureLoad(src, vec2<i32>(nx, ny), 0).r;
      count += 1.0;
    }
  }
  let mean = sum / count;
  let pixel = textureLoad(src, vec2<i32>(cx, cy), 0).r;

  // Pixel is foreground (text) if it is darker than mean - C
  let fg = select(1.0, 0.0, pixel < mean - params.C / 255.0);
  textureStore(dst, vec2<i32>(gid.xy), vec4<f32>(fg, fg, fg, 1.0));
}
