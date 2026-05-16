// Speck suppression via local foreground density.
// A foreground pixel is classified as noise ("isolated speck") if the
// number of foreground pixels in its NxN neighbourhood is less than
// minNeighbours.  Genuine text strokes are always surrounded by many
// neighbouring foreground pixels; isolated dust specks are not.
//
// u: x=W, y=H, z=radius(N=2r+1), w=minNeighbours threshold

@group(0) @binding(0) var srcTex : texture_2d<f32>;
@group(0) @binding(1) var dstTex : texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> u : vec4<u32>;

@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(u.x); let H = i32(u.y);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let cx = i32(gid.x); let cy = i32(gid.y);

  let fg = textureLoad(srcTex, vec2<i32>(cx, cy), 0).r;
  if (fg < 0.5) {
    // Background stays background
    textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(0.0,0.0,0.0,1.0));
    return;
  }

  let R   = i32(u.z);
  let thr = i32(u.w);

  // Count foreground neighbours (excluding self)
  var count = 0;
  for (var dy = -R; dy <= R; dy++) {
    for (var dx = -R; dx <= R; dx++) {
      if (dx == 0 && dy == 0) { continue; }
      let nx = clamp(cx+dx, 0, W-1);
      let ny = clamp(cy+dy, 0, H-1);
      if (textureLoad(srcTex, vec2<i32>(nx,ny), 0).r > 0.5) {
        count++;
      }
    }
  }

  // Keep pixel only if it has enough neighbours (part of real stroke)
  let keep = select(0.0, 1.0, count >= thr);
  textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(keep, keep, keep, 1.0));
}
