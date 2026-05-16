// mergeScore.wgsl — score edges by shared boundary / total perimeter

struct Metric {
  area  : u32,
  min_x : u32,
  min_y : u32,
  max_x : u32,
  max_y : u32,
  perim : u32,
  _p0   : u32,
  _p1   : u32
};

struct Uni {
  edge_count : u32,
  _p0        : u32,
  _p1        : u32,
  _p2        : u32
};

@group(0) @binding(0) var<uniform>            u         : Uni;
@group(0) @binding(1) var<storage,read>       edges     : array<vec2<u32>>;
@group(0) @binding(2) var<storage,read>       sharedLen : array<u32>;   // renamed
@group(0) @binding(3) var<storage,read>       metrics   : array<Metric>;
@group(0) @binding(4) var<storage,read_write> scores    : array<f32>;

@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {

  if (gid.x >= u.edge_count) {
    return;
  }

  let e  = edges[gid.x];
  let sb = f32(sharedLen[gid.x]);

  let pa = f32(metrics[e.x].perim);
  let pb = f32(metrics[e.y].perim);

  scores[gid.x] = sb / (pa + pb - sb + 1.0);
}