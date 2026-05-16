
// CTC collapse: remove blanks and repeated tokens
struct Params { inLen: u32, blank: u32 }
@group(0) @binding(0) var<storage, read>       rawTokens : array<i32>;
@group(0) @binding(1) var<storage, read_write> outTokens : array<i32>;
@group(0) @binding(2) var<storage, read_write> outLen    : array<u32>;
@group(0) @binding(3) var<uniform>             params    : Params;
@compute @workgroup_size(1)
fn main() {
  var prev = -1i; var outIdx = 0u;
  for (var i = 0u; i < params.inLen; i++) {
    let t = rawTokens[i];
    if (t == i32(params.blank) || t == prev) { prev = t; continue; }
    outTokens[outIdx] = t; outIdx++; prev = t;
  }
  outLen[0] = outIdx;
}
