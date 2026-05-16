
// ─── Jump Flooding Algorithm (JFA) distance transform ────────────────────
//
// Each pixel stores the coordinates of its nearest foreground seed.
// Runs in O(log2(max(W,H))) passes with full GPU parallelism.
//
// Binding layout:
//   0 = binaryTex     texture_2d<f32>             (init pass only)
//   1 = seedsIn       texture_2d<u32>  rg32uint    (jfa step input)
//   2 = seedsOut      texture_storage<rg32uint>    (jfa step output)
//   3 = uniforms      vec4<u32>  x=W y=H z=step w=pass(0=init,1=step,2=final)
//   4 = distOut       texture_storage<r32float>    (final pass output)

const INF: u32 = 0xFFFFFFFFu;

@group(0) @binding(0) var binaryTex : texture_2d<f32>;
@group(0) @binding(1) var seedsIn   : texture_2d<u32>;
@group(0) @binding(2) var seedsOut  : texture_storage_2d<rg32uint, write>;
@group(0) @binding(3) var<uniform>  u: vec4<u32>;
@group(0) @binding(4) var distOut   : texture_storage_2d<r32float, write>;

// PASS 0 – initialise seed map
@compute @workgroup_size(16,16)
fn jfa_init(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W=u.x; let H=u.y;
  if (gid.x>=W || gid.y>=H) { return; }
  let fg = textureLoad(binaryTex, vec2<i32>(gid.xy), 0).r > 0.5;
  // Foreground: seed is itself; background: sentinel INF
  let sx = select(INF, gid.x, fg);
  let sy = select(INF, gid.y, fg);
  textureStore(seedsOut, vec2<i32>(gid.xy), vec4<u32>(sx, sy, 0u, 0u));
}

// PASS 1 – JFA step with offset = u.z
@compute @workgroup_size(16,16)
fn jfa_step(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W=i32(u.x); let H=i32(u.y); let step=i32(u.z);
  if (i32(gid.x)>=W || i32(gid.y)>=H) { return; }

  let cur = textureLoad(seedsIn, vec2<i32>(gid.xy), 0).xy;
  var bestSeed = cur;
  var bestDist = select(
    1e30,
    distSq(vec2<f32>(f32(gid.x), f32(gid.y)),
            vec2<f32>(f32(cur.x), f32(cur.y))),
    cur.x != INF
  );

  // Sample 8 neighbours at offset ±step
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      if (dx == 0 && dy == 0) { continue; }
      let nx = i32(gid.x) + dx*step;
      let ny = i32(gid.y) + dy*step;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) { continue; }
      let ns = textureLoad(seedsIn, vec2<i32>(nx, ny), 0).xy;
      if (ns.x == INF) { continue; }
      let d = distSq(vec2<f32>(f32(gid.x), f32(gid.y)),
                     vec2<f32>(f32(ns.x),   f32(ns.y)));
      if (d < bestDist) { bestDist = d; bestSeed = ns; }
    }
  }
  textureStore(seedsOut, vec2<i32>(gid.xy), vec4<u32>(bestSeed.x, bestSeed.y, 0u, 0u));
}

// PASS 2 – finalise: compute sqrt distance and store as r32float
@compute @workgroup_size(16,16)
fn jfa_final(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W=u.x; let H=u.y;
  if (gid.x>=W || gid.y>=H) { return; }
  let seed = textureLoad(seedsIn, vec2<i32>(gid.xy), 0).xy;
  var dist: f32 = 0.0;
  if (seed.x != INF) {
    dist = sqrt(distSq(vec2<f32>(f32(gid.x), f32(gid.y)),
                       vec2<f32>(f32(seed.x), f32(seed.y))));
  }
  textureStore(distOut, vec2<i32>(gid.xy), vec4<f32>(dist, 0., 0., 1.));
}

fn distSq(a: vec2<f32>, b: vec2<f32>) -> f32 {
  let d = a - b; return dot(d, d);
}
