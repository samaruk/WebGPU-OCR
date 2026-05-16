
// Concatenate 4 feature maps along channel dim → fused map
struct Params { W: u32, H: u32, C: u32 }
@group(0) @binding(0) var<storage, read>       p2   : array<f32>;  // [C, H, W]
@group(0) @binding(1) var<storage, read>       p3   : array<f32>;
@group(0) @binding(2) var<storage, read>       p4   : array<f32>;
@group(0) @binding(3) var<storage, read>       p5   : array<f32>;
@group(0) @binding(4) var<storage, read_write> fuse : array<f32>;  // [4C, H, W]
@group(0) @binding(5) var<uniform>             params: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = gid.x; let y = gid.y;
  if (x >= params.W || y >= params.H) { return; }
  for (var c = 0u; c < params.C; c++) {
    let si = (c*params.H+y)*params.W+x;
    fuse[(c              *params.H+y)*params.W+x] = p2[si];
    fuse[((c+params.C)   *params.H+y)*params.W+x] = p3[si];
    fuse[((c+params.C*2u)*params.H+y)*params.W+x] = p4[si];
    fuse[((c+params.C*3u)*params.H+y)*params.W+x] = p5[si];
  }
}
