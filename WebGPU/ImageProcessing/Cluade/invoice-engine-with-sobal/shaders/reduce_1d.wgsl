// shaders/reduce_1d.wgsl
// Parallel reduction over a 1-D array. Supports max and sum operations.
// Two-pass strategy: this is the inner pass; host loops until 1 element remains.

struct Params {
    length:  u32,
    op:      u32,    // 0 = max, 1 = sum
    _pad0:   u32,
    _pad1:   u32,
}

@group(0) @binding(0) var<uniform>             params : Params;
@group(0) @binding(1) var<storage, read>       src    : array<f32>;
@group(0) @binding(2) var<storage, read_write> dst    : array<f32>;

var<workgroup> shared_data: array<f32, 256>;

@compute @workgroup_size(256)
fn main(
    @builtin(global_invocation_id)  gid  : vec3<u32>,
    @builtin(local_invocation_id)   lid  : vec3<u32>,
    @builtin(workgroup_id)          wgid : vec3<u32>,
) {
    let tid = lid.x;
    let i   = gid.x;

    // Load (or identity) into shared memory
    var val: f32;
    if (params.op == 0u) { val = -1e38; } else { val = 0.0; }   // identity for max/sum
    if (i < params.length) { val = src[i]; }
    shared_data[tid] = val;
    workgroupBarrier();

    // Tree reduction
    var stride = 128u;
    loop {
        if (stride == 0u) { break; }
        if (tid < stride) {
            let a = shared_data[tid];
            let b = shared_data[tid + stride];
            if (params.op == 0u) {
                shared_data[tid] = max(a, b);
            } else {
                shared_data[tid] = a + b;
            }
        }
        workgroupBarrier();
        if (stride == 1u) { break; }
        stride = stride >> 1u;
    }

    if (tid == 0u) {
        dst[wgid.x] = shared_data[0];
    }
}
