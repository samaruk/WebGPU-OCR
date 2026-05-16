// shaders/segmentation/labelEquivalenceResolve.wgsl — Union-Find iteration

struct Uniforms {
  width   : u32,
  height  : u32,
  _pad0   : u32,
  _pad1   : u32,
};
@group(0) @binding(0) var<uniform>            u       : Uniforms;
@group(0) @binding(1) var<storage,read_write> labels  : array<u32>;
@group(0) @binding(2) var<storage,read_write> changed : atomic<u32>;

fn root(idx: u32) -> u32 {
  var r = idx;
  for (var i=0u; i<64u; i++) {
    let p = labels[r];
    if (p == 0u || p == r + 1u) { break; }
    r = p - 1u;
  }
  return r;
}

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x>=u.width||gid.y>=u.height) { return; }
  let idx = gid.y*u.width + gid.x;
  if (labels[idx] == 0u) { return; }
  let ra = root(idx);
  // Check 4-neighbours
  let offsets = array<vec2<i32>,4>(vec2<i32>(1,0),vec2<i32>(0,1),vec2<i32>(-1,0),vec2<i32>(0,-1));
  for (var k=0u; k<4u; k++) {
    let nx = i32(gid.x)+offsets[k].x; let ny = i32(gid.y)+offsets[k].y;
    if (nx<0||ny<0||u32(nx)>=u.width||u32(ny)>=u.height) { continue; }
    let ni  = u32(ny)*u.width + u32(nx);
    if (labels[ni] == 0u) { continue; }
    let rb  = root(ni);
    if (ra != rb) {
      let lo = min(ra,rb); let hi = max(ra,rb);
      labels[hi] = lo + 1u;
      atomicAdd(&changed, 1u);
    }
  }
}
