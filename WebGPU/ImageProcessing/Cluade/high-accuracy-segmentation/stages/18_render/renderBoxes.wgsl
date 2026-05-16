// renderBoxes.wgsl
// GPU-side box drawing: marks box boundary pixels with accent color.
struct Params {
  width: f32, height: f32, thickness: f32, _pad: f32,
  color: vec4<f32>,
}
@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<storage, read> boxes: array<vec4<f32>>; // [x1,y1,x2,y2] per box
@group(0) @binding(3) var<uniform> p: Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (f32(gid.x) >= p.width || f32(gid.y) >= p.height) { return; }
  let pos = vec2<i32>(gid.xy);
  let color = textureLoad(inputTex, pos, 0);
  var outColor = color;
  let fx = f32(gid.x); let fy = f32(gid.y);
  let nBoxes = arrayLength(&boxes);
  for (var b = 0u; b < nBoxes; b++) {
    let box = boxes[b];
    let onEdge = (abs(fx - box.x) < p.thickness || abs(fx - box.z) < p.thickness) && (fy >= box.y && fy <= box.w)
              || (abs(fy - box.y) < p.thickness || abs(fy - box.w) < p.thickness) && (fx >= box.x && fx <= box.z);
    if (onEdge) { outColor = p.color; break; }
  }
  textureStore(outputTex, pos, outColor);
}
