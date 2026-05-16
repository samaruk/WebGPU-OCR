// shaders/common/imageAccess.wgsl — Clamped image sampling helpers

fn clamp_coord(c: i32, max_c: i32) -> i32 {
  return clamp(c, 0, max_c - 1);
}

fn safe_pixel(tex: texture_storage_2d<r32float, read>, x: i32, y: i32, w: i32, h: i32) -> f32 {
  return textureLoad(tex, vec2<i32>(clamp_coord(x,w), clamp_coord(y,h))).r;
}

// Bilinear sample from an f32 storage texture
fn bilinear_f32(tex: texture_storage_2d<r32float, read>,
                u: f32, v: f32, w: i32, h: i32) -> f32 {
  let fx = u * f32(w) - 0.5;
  let fy = v * f32(h) - 0.5;
  let x0 = i32(floor(fx));
  let y0 = i32(floor(fy));
  let wx = fx - f32(x0);
  let wy = fy - f32(y0);
  let p00 = safe_pixel(tex, x0,   y0,   w, h);
  let p10 = safe_pixel(tex, x0+1, y0,   w, h);
  let p01 = safe_pixel(tex, x0,   y0+1, w, h);
  let p11 = safe_pixel(tex, x0+1, y0+1, w, h);
  return mix(mix(p00, p10, wx), mix(p01, p11, wx), wy);
}
