// Compute gradient angle + magnitude, write to storage buffer.
// gradBuf layout: [angle0, mag0, angle1, mag1, ...] (2 f32 per pixel)
// Using a storage buffer avoids rgba32float texture_2d<f32> mismatch.
// binaryTex is rgba8unorm → texture_2d<f32> = valid (filterable).

@group(0) @binding(0) var       binaryTex : texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> gradBuf : array<f32>;
@group(0) @binding(2) var<uniform> u : vec4<u32>;

fn e(p: vec2<i32>, W: i32, H: i32) -> f32 {
  return textureLoad(binaryTex, clamp(p, vec2<i32>(0), vec2<i32>(W-1, H-1)), 0).r;
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(u.x); let H = i32(u.y);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let x = i32(gid.x); let y = i32(gid.y);

  let gx = -e(vec2<i32>(x-1,y-1),W,H) + e(vec2<i32>(x+1,y-1),W,H)
           -2.0*e(vec2<i32>(x-1,y),W,H) + 2.0*e(vec2<i32>(x+1,y),W,H)
           -e(vec2<i32>(x-1,y+1),W,H) + e(vec2<i32>(x+1,y+1),W,H);
  let gy = -e(vec2<i32>(x-1,y-1),W,H) - 2.0*e(vec2<i32>(x,y-1),W,H) - e(vec2<i32>(x+1,y-1),W,H)
           +e(vec2<i32>(x-1,y+1),W,H) + 2.0*e(vec2<i32>(x,y+1),W,H) + e(vec2<i32>(x+1,y+1),W,H);

  let idx = u32(y) * u.x + u32(x);
  gradBuf[idx * 2u]      = atan2(gy, gx);  // angle
  gradBuf[idx * 2u + 1u] = sqrt(gx*gx + gy*gy);  // magnitude
}
