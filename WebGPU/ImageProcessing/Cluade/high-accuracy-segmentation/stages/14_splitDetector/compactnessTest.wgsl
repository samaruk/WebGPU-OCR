// compactnessTest.wgsl — placeholder; compactness computed on CPU for now
struct Params { _p: vec4<f32> }
@group(0) @binding(0) var<uniform> p: Params;
@compute @workgroup_size(1,1)
fn main() {}
