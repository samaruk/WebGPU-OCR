// shaders/clustering/spatialGridBuild.wgsl — Insert keypoints into a uniform grid

struct KP { x:f32, y:f32, sigma:f32, angle:f32, octave:u32, layer:u32, resp:f32, _pad:f32 };
struct Uniforms {
  kp_count  : u32,
  cell_size : u32,
  grid_w    : u32,
  grid_h    : u32,
  img_w     : u32,
  img_h     : u32,
  max_per_cell: u32,
  _pad      : u32,
};
@group(0) @binding(0) var<uniform>            u         : Uniforms;
@group(0) @binding(1) var<storage,read>       kps       : array<KP>;
@group(0) @binding(2) var<storage,read_write> cell_ctr  : array<atomic<u32>>;
@group(0) @binding(3) var<storage,read_write> cell_kp   : array<u32>; // [grid_w*grid_h*max_per_cell]

@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.kp_count) { return; }
  let kp  = kps[gid.x];
  let cx  = u32(kp.x) / u.cell_size;
  let cy  = u32(kp.y) / u.cell_size;
  if (cx >= u.grid_w || cy >= u.grid_h) { return; }
  let cell = cy * u.grid_w + cx;
  let slot = atomicAdd(&cell_ctr[cell], 1u);
  if (slot < u.max_per_cell) {
    cell_kp[cell * u.max_per_cell + slot] = gid.x;
  }
}
