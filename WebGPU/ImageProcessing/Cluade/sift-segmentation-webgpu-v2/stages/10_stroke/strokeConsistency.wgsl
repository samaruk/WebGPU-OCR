// strokeConsistency.wgsl — local consistency of SWT values
struct Uni { width:u32, height:u32, thresh:f32, _p:u32 };
@group(0) @binding(0) var<uniform>            u      :Uni;
@group(0) @binding(1) var<storage,read>       swt    :array<f32>;
@group(0) @binding(2) var<storage,read>       labels :array<u32>;
@group(0) @binding(3) var<storage,read_write> consist:array<f32>;
fn p(x:i32,y:i32,w:u32,h:u32)->f32{
  return swt[u32(clamp(y,0,i32(h)-1))*w+u32(clamp(x,0,i32(w)-1))];
}
@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.width||gid.y>=u.height){return;}
  let x=i32(gid.x); let y=i32(gid.y);
  let v=p(x,y,u.width,u.height);
  var sum=0.0; var cnt=0u;
  for(var dy=-2;dy<=2;dy++){
    for(var dx=-2;dx<=2;dx++){
      sum+=p(x+dx,y+dy,u.width,u.height); cnt+=1u;
    }
  }
  let mean=sum/f32(cnt);
  let ratio=select(v/mean,mean/v,v>mean);
  consist[gid.y*u.width+gid.x]=select(0.0,1.0,ratio>=(1.0-u.thresh));
}
