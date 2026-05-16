// stages/13_graphMerge_phase1/deterministicMergeLoose.wgsl
//
// Label-remap pass — applied after the CPU union-find has resolved the
// final merge groups.
//
// Each pixel's old label ID is looked up in mergeTable[] and replaced with
// its canonical root label.  Background pixels (label == 0) are left as 0.
//
// Called once per pipeline run immediately after runDeterministicMergeLoose()
// produces the mergeTable on the CPU side.

struct Params {
    width  : u32,
    height : u32,
    _pad0  : u32,
    _pad1  : u32,
}

@group(0) @binding(0) var                      inLabels   : texture_2d<u32>;
@group(0) @binding(1) var<storage, read>       mergeTable : array<u32>;   // old_id → canonical_id
@group(0) @binding(2) var                      outLabels  : texture_storage_2d<r32uint, write>;
@group(0) @binding(3) var<uniform>             p          : Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
    if (gid.x >= p.width || gid.y >= p.height) { return; }

    let pos      = vec2<i32>(i32(gid.x), i32(gid.y));
    let oldLabel = textureLoad(inLabels, pos, 0).r;

    var newLabel = oldLabel;

    // Only remap if the old label has a valid entry in the merge table.
    // Label 0 is background and is always left as 0.
    if (oldLabel > 0u && oldLabel < arrayLength(&mergeTable)) {
        newLabel = mergeTable[oldLabel];
    }

    textureStore(outLabels, pos, vec4<u32>(newLabel, 0u, 0u, 0u));
}
