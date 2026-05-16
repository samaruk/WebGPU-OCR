// descriptorHistogram.wgsl — 4×4×8 = 128-bin SIFT descriptor accumulation
struct Uni { width:u32, height:u32, kp_count:u32, scale_mul:f32, desc_width:u32, hist_bins:u32, _p0:u32, _p1:u32 };
@group(0) @binding(0) var<uniform>            u    :Uni;
@group(0) @binding(1) var<storage,read>       kps  :array<vec4<f32>>;
@group(0) @binding(2) var<storage,read>       mag  :array<f32>;
@group(0) @binding(3) var<storage,read>       ori  :array<f32>;
@group(0) @binding(4) var<storage,read_write> desc :array<f32>; // [kp*128]
const TWO_PI:f32=6.28318530717959;

@compute @workgroup_size(1,1,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.kp_count){return;}
  let kp=kps[gid.x]; let cx=kp.x; let cy=kp.y; let sig=kp.z; let angle=kp.w;
  let cosA=cos(-angle); let sinA=sin(-angle);
  let radius=u.scale_mul*sig*f32(u.desc_width)*0.5;
  let r=i32(ceil(radius*1.4142));
  let bins=i32(u.hist_bins); let dw=i32(u.desc_width);
  let base=gid.x*128u;
  for(var i=0u;i<128u;i++){desc[base+i]=0.0;}
  for(var dy=-r;dy<=r;dy++){
    for(var dx=-r;dx<=r;dx++){
      let nx=i32(cx)+dx; let ny=i32(cy)+dy;
      if(nx<0||ny<0||u32(nx)>=u.width||u32(ny)>=u.height){continue;}
      let rx=cosA*f32(dx)-sinA*f32(dy); let ry=sinA*f32(dx)+cosA*f32(dy);
      let norm=f32(dw)*0.5/(u.scale_mul*sig);
      let nbx=rx*norm+f32(dw-1)*0.5; let nby=ry*norm+f32(dw-1)*0.5;
      if(nbx<-1.0||nby<-1.0||nbx>f32(dw)||nby>f32(dw)){continue;}
      let pidx=u32(ny)*u.width+u32(nx);
      let gm=mag[pidx];
      var go=ori[pidx]-angle;
      if(go<0.0){go+=TWO_PI;} if(go>=TWO_PI){go-=TWO_PI;}
      let wg=exp(-(rx*rx+ry*ry)/(2.0*(u.scale_mul*sig)*(u.scale_mul*sig)));
      let obin=go/TWO_PI*f32(bins);
      for(var si=0;si<dw;si++){
        let dsi=abs(nbx-(f32(si)+0.5)); if(dsi>1.0){continue;}
        let wsi=1.0-dsi;
        for(var ti=0;ti<dw;ti++){
          let dti=abs(nby-(f32(ti)+0.5)); if(dti>1.0){continue;}
          let wti=1.0-dti;
          let bi0=i32(floor(obin))%bins; let bi1=(bi0+1)%bins; let wo=obin-floor(obin);
          let cb=base+u32((ti*dw+si)*bins);
          desc[cb+u32(bi0)]+=gm*wg*wsi*wti*(1.0-wo);
          desc[cb+u32(bi1)]+=gm*wg*wsi*wti*wo;
        }
      }
    }
  }
}
