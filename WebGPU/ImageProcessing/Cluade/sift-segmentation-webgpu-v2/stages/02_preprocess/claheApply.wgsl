// claheApply.wgsl — bilinear interpolate CDF values to remap pixel intensity
struct Uni { width:u32, height:u32, tile_size:u32, num_bins:u32, tiles_x:u32, tiles_y:u32, clip:f32, _p:u32 };
@group(0) @binding(0) var<uniform>            u     : Uni;
@group(0) @binding(1) var<storage,read>       src   : array<f32>;
@group(0) @binding(2) var<storage,read>       cdfs  : array<f32>; // [tiles_y*tiles_x*num_bins]
@group(0) @binding(3) var<storage,read_write> dst   : array<f32>;

fn tile_map(tx:u32,ty:u32,bin:u32)->f32{
  let safe_tx=min(tx,u.tiles_x-1u); let safe_ty=min(ty,u.tiles_y-1u);
  return cdfs[(safe_ty*u.tiles_x+safe_tx)*u.num_bins+bin];
}

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.width||gid.y>=u.height){return;}
  let v    = src[gid.y*u.width+gid.x];
  let bin  = u32(clamp(v*f32(u.num_bins),0.0,f32(u.num_bins-1u)));
  let ts   = f32(u.tile_size);
  let tx   = gid.x/u.tile_size; let ty = gid.y/u.tile_size;
  let fx   = (f32(gid.x)+0.5)/ts - f32(tx) - 0.5;
  let fy   = (f32(gid.y)+0.5)/ts - f32(ty) - 0.5;
  let wx   = clamp(fx,0.0,1.0); let wy=clamp(fy,0.0,1.0);
  let q00  = tile_map(tx,ty,bin);     let q10=tile_map(tx+1u,ty,bin);
  let q01  = tile_map(tx,ty+1u,bin);  let q11=tile_map(tx+1u,ty+1u,bin);
  dst[gid.y*u.width+gid.x] = mix(mix(q00,q10,wx),mix(q01,q11,wx),wy);
}
