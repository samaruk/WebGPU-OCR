// claheHistogram.wgsl — accumulate per-tile histogram
struct Uni { width:u32, height:u32, tile_size:u32, num_bins:u32, tiles_x:u32, tiles_y:u32, _p0:u32, _p1:u32 };
@group(0) @binding(0) var<uniform>               u     : Uni;
@group(0) @binding(1) var<storage,read>          gray  : array<f32>;
@group(0) @binding(2) var<storage,read_write>    hists : array<atomic<u32>>;

var<workgroup> smem : array<atomic<u32>,256>;

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>,
        @builtin(local_invocation_index) lid:u32,
        @builtin(workgroup_id) wgid:vec3<u32>) {
  if(lid<u.num_bins){atomicStore(&smem[lid],0u);}
  workgroupBarrier();
  if(gid.x<u.width&&gid.y<u.height){
    let v=gray[gid.y*u.width+gid.x];
    let bin=u32(clamp(v*f32(u.num_bins),0.0,f32(u.num_bins-1u)));
    atomicAdd(&smem[bin],1u);
  }
  workgroupBarrier();
  let base=(wgid.y*u.tiles_x+wgid.x)*u.num_bins;
  if(lid<u.num_bins){ atomicAdd(&hists[base+lid],atomicLoad(&smem[lid])); }
}
