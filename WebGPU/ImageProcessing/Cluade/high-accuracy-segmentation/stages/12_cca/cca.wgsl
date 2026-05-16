// cca.wgsl — GPU connected component labeling via union-find
struct Params { width: f32, height: f32, _p0: f32, _p1: f32 }
@group(0) @binding(0) var inputTex: texture_2d<u32>;
@group(0) @binding(1) var<storage, read_write> roots: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> p: Params;

fn idx(x: i32, y: i32, W: i32) -> u32 { return u32(y * W + x); }

@compute @workgroup_size(8, 8)
fn init(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let label = textureLoad(inputTex, vec2<i32>(gid.xy), 0).r;
  let i = idx(i32(gid.x), i32(gid.y), W);
  atomicStore(&roots[i], select(0u, i + 1u, label > 0u));
}

@compute @workgroup_size(8, 8)
fn union_pass(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let pos = vec2<i32>(gid.xy);
  let i = idx(pos.x, pos.y, W);
  let myRoot = atomicLoad(&roots[i]);
  if (myRoot == 0u) { return; }
  // Union with 4-connected neighbors that have the same watershed label
  let myLabel = textureLoad(inputTex, pos, 0).r;
  let offsets = array<vec2<i32>, 4>(vec2(-1,0), vec2(1,0), vec2(0,-1), vec2(0,1));
  for (var n = 0; n < 4; n++) {
    let sp = pos + offsets[n];
    if (sp.x < 0 || sp.y < 0 || sp.x >= W || sp.y >= H) { continue; }
    let ni = idx(sp.x, sp.y, W);
    let nLabel = textureLoad(inputTex, sp, 0).r;
    if (nLabel == myLabel) {
      let nRoot = atomicLoad(&roots[ni]);
      if (nRoot > 0u && nRoot != myRoot) {
        let minRoot = min(myRoot, nRoot);
        atomicMin(&roots[i],  minRoot);
        atomicMin(&roots[ni], minRoot);
      }
    }
  }
}

@group(0) @binding(0) var<storage, read> rootsRead: array<u32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<r32uint, write>;
@group(0) @binding(2) var<uniform> p2: Params;

@compute @workgroup_size(8, 8)
fn flatten(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p2.width); let H = i32(p2.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let i = idx(i32(gid.x), i32(gid.y), W);
  textureStore(outputTex, vec2<i32>(gid.xy), vec4<u32>(rootsRead[i], 0u, 0u, 0u));
}
