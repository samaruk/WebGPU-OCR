// spatialGridBuild.wgsl — insert keypoints into uniform spatial grid
struct Uni { kp_count:u32, cell_size:u32, grid_w:u32, grid_h:u32, img_w:u32, img_h:u32, max_per:u32, _p:u32 };
@group(0) @binding(0) var<uniform>            u       :Uni;
@group(0) @binding(1) var<storage,read>       kps     :array<vec4<f32>>;
@group(0) @binding(2) var<storage,read_write> cell_ctr:array<atomic<u32>>;
@group(0) @binding(3) var<storage,read_write> cell_kp :array<u32>;
@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.kp_count){return;}
  let kp=kps[gid.x]; let cx=u32(kp.x)/u.cell_size; let cy=u32(kp.y)/u.cell_size;
  if(cx>=u.grid_w||cy>=u.grid_h){return;}
  let cell=cy*u.grid_w+cx;
  let slot=atomicAdd(&cell_ctr[cell],1u);
  if(slot<u.max_per){cell_kp[cell*u.max_per+slot]=gid.x;}
}
