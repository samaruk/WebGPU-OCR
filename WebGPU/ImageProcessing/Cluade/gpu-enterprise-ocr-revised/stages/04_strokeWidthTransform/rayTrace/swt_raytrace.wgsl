@group(0) @binding(0) var       edgeTex : texture_2d<f32>;
@group(0) @binding(1) var<storage, read> gradBuf : array<f32>;
@group(0) @binding(2) var<storage, read_write> swtBuf : array<atomic<u32>>;
@group(0) @binding(3) var<uniform> u : vec4<u32>;

@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(u.x); let H = i32(u.y);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }

  let edge = textureLoad(edgeTex, vec2<i32>(gid.xy), 0).r;
  if (edge < 0.5) { return; }

  let idx   = gid.y * u.x + gid.x;
  let angle = gradBuf[idx * 2u];
  let dx = cos(angle); let dy = sin(angle);
  let maxSW = i32(u.z);
  var px = f32(gid.x) + 0.5;
  var py = f32(gid.y) + 0.5;

  for (var step = 1; step <= maxSW; step++) {
    px += dx; py += dy;
    let ix = i32(px); let iy = i32(py);
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) { break; }
    if (textureLoad(edgeTex, vec2<i32>(ix,iy), 0).r > 0.5) {
      let ni  = u32(iy) * u.x + u32(ix);
      let g2  = gradBuf[ni * 2u];
      let dotV = cos(angle)*cos(g2) + sin(angle)*sin(g2);
      if (dotV < -0.3) {
        // Write float stroke-width as u32 bits via atomicMin.
        // Buffer is pre-cleared to 0xFFFFFFFF; positive f32 bits are ordered
        // the same as u32, so atomicMin correctly keeps the minimum.
        let sw_bits = bitcast<u32>(f32(step));
        for (var s = 0; s <= step; s++) {
          let rx = i32(f32(gid.x) + dx*f32(s) + 0.5);
          let ry = i32(f32(gid.y) + dy*f32(s) + 0.5);
          if (rx >= 0 && ry >= 0 && rx < W && ry < H) {
            atomicMin(&swtBuf[u32(ry)*u.x + u32(rx)], sw_bits);
          }
        }
      }
      break;
    }
  }
}
