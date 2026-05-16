// shaders/graph/splitScoreCompute.wgsl — Score components for splitting (aspect ratio + SWT)

struct Metric { area:u32, min_x:u32, min_y:u32, max_x:u32, max_y:u32, perimeter:u32, _p0:u32, _p1:u32 };
struct Uniforms { label_count:u32, _pad0:u32, _pad1:u32, _pad2:u32 };
@group(0) @binding(0) var<uniform>            u       : Uniforms;
@group(0) @binding(1) var<storage,read>       metrics : array<Metric>;
@group(0) @binding(2) var<storage,read>       medians : array<f32>; // median SWT per label
@group(0) @binding(3) var<storage,read_write> scores  : array<f32>;

@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.label_count) { return; }
  let m = metrics[gid.x];
  let w = f32(m.max_x - m.min_x + 1u);
  let h = f32(m.max_y - m.min_y + 1u);
  let ar = max(w, h) / (min(w, h) + 1.0);
  let sw = medians[gid.x];
  // High aspect-ratio + large SWT → candidate for split
  scores[gid.x] = clamp(ar * sw / (w + h + 1.0), 0.0, 1.0);
}
