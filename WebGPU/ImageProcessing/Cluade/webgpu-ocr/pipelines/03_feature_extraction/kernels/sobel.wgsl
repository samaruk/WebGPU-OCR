
struct Params { width: u32, height: u32 }
@group(0) @binding(0) var<storage, read>       input : array<f32>;
@group(0) @binding(1) var<storage, read_write> gx    : array<f32>;
@group(0) @binding(2) var<storage, read_write> gy    : array<f32>;
@group(0) @binding(3) var<uniform>             params: Params;

fn px(x_: i32, y_: i32, W: u32, H: u32) -> f32 {
  let x = clamp(x_, 0, i32(W)-1);
  let y = clamp(y_, 0, i32(H)-1);
  return input[u32(y)*W+u32(x)];
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let x = i32(gid.x); let y = i32(gid.y);
  if (u32(x) >= params.width || u32(y) >= params.height) { return; }
  let W = params.width; let H = params.height;
  let kx = -px(x-1,y-1,W,H) - 2.0*px(x-1,y,W,H) - px(x-1,y+1,W,H)
           + px(x+1,y-1,W,H) + 2.0*px(x+1,y,W,H) + px(x+1,y+1,W,H);
  let ky = -px(x-1,y-1,W,H) - 2.0*px(x,y-1,W,H) - px(x+1,y-1,W,H)
           + px(x-1,y+1,W,H) + 2.0*px(x,y+1,W,H) + px(x+1,y+1,W,H);
  let i = u32(y)*W+u32(x);
  gx[i] = kx / 8.0;
  gy[i] = ky / 8.0;
}
