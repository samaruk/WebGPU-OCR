
struct Params { seqLen: u32, dModel: u32, dHead: u32, nHead: u32 }
@group(0) @binding(0) var<storage, read>       x   : array<f32>;  // [S, dModel]
@group(0) @binding(1) var<storage, read>       Wq  : array<f32>;  // [dModel, nHead*dHead]
@group(0) @binding(2) var<storage, read>       Wk  : array<f32>;
@group(0) @binding(3) var<storage, read>       Wv  : array<f32>;
@group(0) @binding(4) var<storage, read_write> Q   : array<f32>;
@group(0) @binding(5) var<storage, read_write> K   : array<f32>;
@group(0) @binding(6) var<storage, read_write> V   : array<f32>;
@group(0) @binding(7) var<uniform>             params: Params;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let s = gid.x; let d = gid.y;
  let D = params.nHead * params.dHead;
  if (s >= params.seqLen || d >= D) { return; }
  var q = 0.0; var k = 0.0; var v = 0.0;
  for (var m = 0u; m < params.dModel; m++) {
    let xi = x[s*params.dModel+m];
    q += xi * Wq[m*D+d];
    k += xi * Wk[m*D+d];
    v += xi * Wv[m*D+d];
  }
  let i = s*D+d;
  Q[i] = q; K[i] = k; V[i] = v;
}
