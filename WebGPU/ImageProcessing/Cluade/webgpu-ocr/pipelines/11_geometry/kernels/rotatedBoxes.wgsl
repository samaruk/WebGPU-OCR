
struct Params { N: u32 }
@group(0) @binding(0) var<storage, read>       bboxes  : array<f32>;  // [N,4] x0,y0,x1,y1
@group(0) @binding(1) var<storage, read_write> rotBoxes: array<f32>;  // [N,5] cx,cy,w,h,angle
@group(0) @binding(2) var<uniform>             params  : Params;
const PI = 3.14159265358979;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let n = gid.x;
  if (n >= params.N) { return; }
  let x0 = bboxes[n*4u]; let y0 = bboxes[n*4u+1u];
  let x1 = bboxes[n*4u+2u]; let y1 = bboxes[n*4u+3u];
  rotBoxes[n*5u  ] = (x0+x1)*0.5;
  rotBoxes[n*5u+1u] = (y0+y1)*0.5;
  rotBoxes[n*5u+2u] = x1-x0;
  rotBoxes[n*5u+3u] = y1-y0;
  rotBoxes[n*5u+4u] = 0.0;
}
