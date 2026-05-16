// shaders/sift/extrema3D.wgsl — Local extrema detection in 3×3×3 DoG neighbourhood

struct Uniforms {
  width     : u32,
  height    : u32,
  max_kp    : u32,
  thresh    : f32,
};
@group(0) @binding(0) var<uniform>            u       : Uniforms;
@group(0) @binding(1) var<storage,read>       dog_prev: array<f32>; // scale s-1
@group(0) @binding(2) var<storage,read>       dog_cur : array<f32>; // scale s
@group(0) @binding(3) var<storage,read>       dog_next: array<f32>; // scale s+1
@group(0) @binding(4) var<storage,read_write> counter : atomic<u32>;
@group(0) @binding(5) var<storage,read_write> kp_xy   : array<u32>; // packed x<<16|y

fn idx(x:i32,y:i32) -> u32 { return u32(y*i32(u.width)+x); }

fn get(buf:ptr<storage,array<f32>,read>,x:i32,y:i32)->f32 {
  let cx=clamp(x,0,i32(u.width)-1); let cy=clamp(y,0,i32(u.height)-1);
  return (*buf)[u32(cy*i32(u.width)+cx)];
}

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x < 1u || gid.y < 1u ||
      gid.x >= u.width-1u || gid.y >= u.height-1u) { return; }
  let x = i32(gid.x); let y = i32(gid.y);
  let v = get(&dog_cur, x, y);
  if (abs(v) < u.thresh) { return; }
  let isMax = v > 0.0;
  for (var dy=-1; dy<=1; dy++) {
    for (var dx=-1; dx<=1; dx++) {
      if (dx==0 && dy==0) { continue; }
      let vc = get(&dog_cur,  x+dx,y+dy);
      let vp = get(&dog_prev, x+dx,y+dy);
      let vn = get(&dog_next, x+dx,y+dy);
      if (isMax && (vc>=v || vp>=v || vn>=v)) { return; }
      if (!isMax && (vc<=v || vp<=v || vn<=v)) { return; }
    }
  }
  // Also check scale neighbours at same xy
  let vp0=get(&dog_prev,x,y); let vn0=get(&dog_next,x,y);
  if (isMax && (vp0>=v || vn0>=v)) { return; }
  if (!isMax && (vp0<=v || vn0<=v)) { return; }

  let slot = atomicAdd(&counter, 1u);
  if (slot < u.max_kp) {
    kp_xy[slot] = (gid.x << 16u) | gid.y;
  }
}
