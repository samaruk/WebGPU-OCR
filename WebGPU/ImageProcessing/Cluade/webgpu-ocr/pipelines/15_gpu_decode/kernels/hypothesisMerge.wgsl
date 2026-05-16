
struct Params { beamWidth: u32, seqLen: u32 }
@group(0) @binding(0) var<storage, read>       tokens : array<i32>;  // [beamWidth, seqLen]
@group(0) @binding(1) var<storage, read>       scores : array<f32>;
@group(0) @binding(2) var<storage, read_write> merged : array<i32>;  // best beam tokens
@group(0) @binding(3) var<uniform>             params : Params;
@compute @workgroup_size(1)
fn main() {
  var bestBeam = 0u; var bestScore = scores[0];
  for (var b = 1u; b < params.beamWidth; b++) {
    if (scores[b] > bestScore) { bestScore = scores[b]; bestBeam = b; }
  }
  for (var t = 0u; t < params.seqLen; t++) {
    merged[t] = tokens[bestBeam*params.seqLen+t];
  }
}
