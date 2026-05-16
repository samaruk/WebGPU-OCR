
struct Params { N: u32, lineGap: f32 }
@group(0) @binding(0) var<storage, read>       bboxes : array<f32>;   // [N,4]
@group(0) @binding(1) var<storage, read_write> paraId : array<u32>;   // [N]
@group(0) @binding(2) var<uniform>             params : Params;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let n = gid.x;
  if (n >= params.N) { return; }
  var pid = 0u;
  if (n == 0u) { paraId[0] = 0u; return; }
  let y0 = bboxes[n*4u+1u];
  let prevY1 = bboxes[(n-1u)*4u+3u];
  let gap = y0 - prevY1;
  pid = select(paraId[n-1u], paraId[n-1u]+1u, gap > params.lineGap);
  paraId[n] = pid;
}
