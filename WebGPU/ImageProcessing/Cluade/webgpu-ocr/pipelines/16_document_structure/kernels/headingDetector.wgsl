
struct Params { N: u32, avgFontSize: f32, headingRatio: f32 }
@group(0) @binding(0) var<storage, read>       blockMeta : array<f32>;  // [N, 4] = x0,y0,x1,y1
@group(0) @binding(1) var<storage, read_write> isHeading : array<u32>;
@group(0) @binding(2) var<uniform>             params    : Params;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let n = gid.x;
  if (n >= params.N) { return; }
  let h = blockMeta[n*4u+3u] - blockMeta[n*4u+1u];
  isHeading[n] = select(0u, 1u, h > params.avgFontSize * params.headingRatio);
}
