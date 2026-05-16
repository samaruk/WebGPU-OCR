// orientationAssign.wgsl — 36-bin gradient histogram → dominant orientation
struct Uni { width:u32, height:u32, kp_count:u32, num_bins:u32,
             ori_radius:f32, sig_fac:f32, peak_ratio:f32, _p:u32 };
@group(0) @binding(0) var<uniform>            u      :Uni;
@group(0) @binding(1) var<storage,read>       kp_in  :array<vec4<f32>>;
@group(0) @binding(2) var<storage,read>       mag    :array<f32>;
@group(0) @binding(3) var<storage,read>       ori    :array<f32>;
@group(0) @binding(4) var<storage,read_write> kp_out :array<vec4<f32>>;
@group(0) @binding(5) var<storage,read_write> ctr    :atomic<u32>;

const TWO_PI:f32=6.28318530717959;
var<workgroup> hist:array<f32,36>;

@compute @workgroup_size(1,1,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.kp_count){return;}
  let kp=kp_in[gid.x]; let cx=kp.x; let cy=kp.y; let sig=kp.z;
  let rad=u.ori_radius*sig; let wsig=rad*u.sig_fac; let inv2=1.0/(2.0*wsig*wsig);
  let bins=i32(u.num_bins);
  for(var i=0;i<36;i++){hist[i]=0.0;}
  let r=i32(ceil(rad));
  for(var dy=-r;dy<=r;dy++){
    for(var dx=-r;dx<=r;dx++){
      let nx=i32(cx)+dx; let ny=i32(cy)+dy;
      if(nx<0||ny<0||u32(nx)>=u.width||u32(ny)>=u.height){continue;}
      let w=exp(-f32(dx*dx+dy*dy)*inv2);
      let idx=u32(ny)*u.width+u32(nx);
      let bin=i32(ori[idx]/TWO_PI*f32(bins))%bins;
      hist[bin]+=mag[idx]*w;
    }
  }
  var mx=hist[0];
  for(var i=1;i<bins;i++){mx=max(mx,hist[i]);}
  let thr=mx*u.peak_ratio;
  for(var i=0;i<bins;i++){
    let h=hist[i]; let hl=hist[(i-1+bins)%bins]; let hr=hist[(i+1)%bins];
    if(h>=thr&&h>=hl&&h>=hr){
      let off=0.5*(hl-hr)/(hl-2.0*h+hr+1e-10);
      var angle=(f32(i)+off+0.5)/f32(bins)*TWO_PI;
      if(angle<0.0){angle+=TWO_PI;} if(angle>=TWO_PI){angle-=TWO_PI;}
      kp_out[atomicAdd(&ctr,1u)]=vec4<f32>(cx,cy,sig,angle);
    }
  }
}
