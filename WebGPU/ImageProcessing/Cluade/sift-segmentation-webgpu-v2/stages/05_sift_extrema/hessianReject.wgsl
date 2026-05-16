// hessianReject.wgsl — edge rejection via Hessian principal curvature ratio
struct Uni { width:u32, count:u32, edge_thresh:f32, _p:u32 };
@group(0) @binding(0) var<uniform>            u     :Uni;
@group(0) @binding(1) var<storage,read>       dog   :array<f32>;
@group(0) @binding(2) var<storage,read>       kp_in :array<u32>;
@group(0) @binding(3) var<storage,read_write> ctr   :atomic<u32>;
@group(0) @binding(4) var<storage,read_write> kp_out:array<u32>;

fn d(x:i32,y:i32,w:u32)->f32{
  let cx=clamp(x,0,i32(w)-1); let cy=clamp(y,0,99999);
  return dog[u32(cy)*w+u32(cx)];
}

@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.count){return;}
  let pk=kp_in[gid.x]; let xi=i32(pk>>16u); let yi=i32(pk&0xFFFFu);
  let v=d(xi,yi,u.width);
  let dxx=d(xi+1,yi,u.width)-2.0*v+d(xi-1,yi,u.width);
  let dyy=d(xi,yi+1,u.width)-2.0*v+d(xi,yi-1,u.width);
  let dxy=(d(xi+1,yi+1,u.width)-d(xi-1,yi+1,u.width)-d(xi+1,yi-1,u.width)+d(xi-1,yi-1,u.width))*0.25;
  let tr=dxx+dyy; let det=dxx*dyy-dxy*dxy;
  let r=u.edge_thresh; let thr=(r+1.0)*(r+1.0)/r;
  if(det>0.0&&(tr*tr/det)<thr){ kp_out[atomicAdd(&ctr,1u)]=pk; }
}
