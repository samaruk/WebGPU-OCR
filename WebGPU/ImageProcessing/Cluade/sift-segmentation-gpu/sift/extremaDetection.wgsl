// sift/extremaDetection.wgsl – GPU 3×3×3 extrema detection kernel
struct Uniforms { width: u32, height: u32, contrastThresh: f32, edgeThresh: f32 }
@group(0) @binding(0) var<uniform> u    : Uniforms;
@group(0) @binding(1) var dogPrev : texture_2d<f32>;
@group(0) @binding(2) var dogCurr : texture_2d<f32>;
@group(0) @binding(3) var dogNext : texture_2d<f32>;
@group(0) @binding(4) var<storage, read_write> keypointBuffer : array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> counter : atomic<u32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x < 1u || gid.y < 1u || gid.x >= u.width - 1u || gid.y >= u.height - 1u) { return; }
  let p  = vec2<i32>(gid.xy);
  let v  = textureLoad(dogCurr, p, 0).r;
  if (abs(v) < u.contrastThresh * 0.5) { return; }

  var isMax = true; var isMin = true;
  for (var ds = -1; ds <= 1; ds++) {
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        if (ds == 0 && dy == 0 && dx == 0) { continue; }
        let nb_p = p + vec2<i32>(dx, dy);
        var nb = 0.0;
        if (ds < 0) { nb = textureLoad(dogPrev, nb_p, 0).r; }
        else if (ds > 0) { nb = textureLoad(dogNext, nb_p, 0).r; }
        else { nb = textureLoad(dogCurr, nb_p, 0).r; }
        if (nb >= v) { isMax = false; }
        if (nb <= v) { isMin = false; }
      }
    }
  }
  if (!isMax && !isMin) { return; }

  let idx = atomicAdd(&counter, 1u);
  keypointBuffer[idx] = vec4<f32>(f32(gid.x), f32(gid.y), v, 0.0);
}
