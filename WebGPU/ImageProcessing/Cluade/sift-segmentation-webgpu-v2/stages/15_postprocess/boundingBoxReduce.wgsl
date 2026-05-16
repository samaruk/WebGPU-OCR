// boundingBoxReduce.wgsl — atomic bounding box per component
struct Uni { n:u32, img_w:u32, num_lbl:u32, _p:u32 };
struct BBox { min_x:atomic<u32>,min_y:atomic<u32>,max_x:atomic<u32>,max_y:atomic<u32>,area:atomic<u32>,_p0:u32,_p1:u32,_p2:u32 };
@group(0) @binding(0) var<uniform>            u     :Uni;
@group(0) @binding(1) var<storage,read>       labels:array<u32>;
@group(0) @binding(2) var<storage,read_write> bboxes:array<BBox>;
@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.n){return;}
  let l=labels[gid.x]; if(l==0u||l>=u.num_lbl){return;}
  let x=gid.x%u.img_w; let y=gid.x/u.img_w;
  atomicMin(&bboxes[l].min_x,x); atomicMin(&bboxes[l].min_y,y);
  atomicMax(&bboxes[l].max_x,x); atomicMax(&bboxes[l].max_y,y);
  atomicAdd(&bboxes[l].area,1u);
}
