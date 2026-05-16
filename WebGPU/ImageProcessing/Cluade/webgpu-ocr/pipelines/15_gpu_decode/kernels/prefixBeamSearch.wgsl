
// Prefix beam search: extend top-K beams per time step
struct Params { S: u32, nClass: u32, beamWidth: u32, blank: u32 }
@group(0) @binding(0) var<storage, read>       logProbs   : array<f32>;  // [S, nClass]
@group(0) @binding(1) var<storage, read>       beamTokens : array<i32>;  // [beamWidth, maxLen]
@group(0) @binding(2) var<storage, read>       beamScores : array<f32>;  // [beamWidth]
@group(0) @binding(3) var<storage, read_write> newTokens  : array<i32>;
@group(0) @binding(4) var<storage, read_write> newScores  : array<f32>;
@group(0) @binding(5) var<uniform>             params     : Params;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let bi = gid.x;
  if (bi >= params.beamWidth) { return; }
  // Find best extension token for this beam at current time step (simplified)
  var bestTok = i32(params.blank); var bestScore = -1e30;
  for (var c = 0u; c < params.nClass; c++) {
    let sc = beamScores[bi] + logProbs[0u*params.nClass+c];
    if (sc > bestScore) { bestScore = sc; bestTok = i32(c); }
  }
  newScores[bi] = bestScore;
  newTokens[bi] = bestTok;
}
