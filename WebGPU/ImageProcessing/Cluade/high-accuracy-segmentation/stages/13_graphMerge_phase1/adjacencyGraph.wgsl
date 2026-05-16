// stages/13_graphMerge_phase1/adjacencyGraph.wgsl
//
// GPU-side adjacency detection between labeled components.
// For every foreground pixel, scans a radius-r neighbourhood and records
// the minimum pixel-distance between each unique label pair found.
//
// Output: adjacencyList[pair_index] = min distance in pixels (u32).
// pair_index = (min(labelA, labelB) - 1) * MAX_LABELS + (max(labelA, labelB) - 1)
//
// The CPU (adjacencyGraph.js) reads this back and applies the
// normalised gap threshold:  normGap = dist / meanStrokeWidth < mergeLooseGapFactor

struct Params {
    width     : u32,
    height    : u32,
    max_gap   : f32,   // pixel radius to search (= mergeLooseGapFactor * meanStrokeWidth)
    max_labels: u32,   // total number of distinct labels (used for pair indexing)
}

@group(0) @binding(0) var                          labelTex      : texture_2d<u32>;
@group(0) @binding(1) var<storage, read_write>     adjacencyList : array<atomic<u32>>;
@group(0) @binding(2) var<uniform>                 p             : Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
    if (gid.x >= p.width || gid.y >= p.height) { return; }

    let pos   = vec2<i32>(i32(gid.x), i32(gid.y));
    let label = textureLoad(labelTex, pos, 0).r;
    if (label == 0u) { return; }

    let r = i32(ceil(p.max_gap));

    for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
            if (dx == 0 && dy == 0) { continue; }

            // Only consider pixels within the circular radius
            let distSq = f32(dx * dx + dy * dy);
            if (distSq > p.max_gap * p.max_gap) { continue; }

            let sx = clamp(pos.x + dx, 0, i32(p.width)  - 1);
            let sy = clamp(pos.y + dy, 0, i32(p.height) - 1);
            let nl = textureLoad(labelTex, vec2<i32>(sx, sy), 0).r;

            if (nl == 0u || nl == label) { continue; }

            let lo = min(label, nl) - 1u;
            let hi = max(label, nl) - 1u;

            // Guard against out-of-bounds (label IDs can exceed max_labels on
            // images with very many components — just skip those pairs)
            if (lo >= p.max_labels || hi >= p.max_labels) { continue; }

            let pairIdx = lo * p.max_labels + hi;
            if (pairIdx >= arrayLength(&adjacencyList)) { continue; }

            let dist = u32(sqrt(distSq));
            atomicMin(&adjacencyList[pairIdx], dist);
        }
    }
}
