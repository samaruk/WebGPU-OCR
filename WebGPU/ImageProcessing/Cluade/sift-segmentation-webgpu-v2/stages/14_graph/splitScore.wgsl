// splitScore.wgsl — score components for splitting
struct Metric { area:u32, min_x:u32, min_y:u32, max_x:u32, max_y:u32, perim:u32, _p0:u32, _p1:u32 };
struct Uni { n:u32, _p0:u32, _p1:u32, _p2:u32 };
@group(0) @binding(0) var<uniform>         u      :Uni;
@group(0) @binding(1) var<storage,read>    metrics:array<Metric>;
@group(0) @binding(2) var<storage,read>    medians:array<f32>;
@group(0) @binding(3) var<storage,read_write> scores:array<f32>;
@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.n){return;}
  let m=metrics[gid.x];
  let ww=f32(m.max_x-m.min_x+1u); let hh=f32(m.max_y-m.min_y+1u);
  let ar=max(ww,hh)/(min(ww,hh)+1.0);
  scores[gid.x]=clamp(ar*medians[gid.x]/(ww+hh+1.0),0.0,1.0);
}
