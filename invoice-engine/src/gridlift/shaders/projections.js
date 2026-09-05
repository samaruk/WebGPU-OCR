import { wgsl } from './common.js';

/* ------------------------------------------------------------------ *
 * Stage 12 - projection analysis.
 *
 * Row and column sums of two masks at once (typically border-suppressed ink,
 * and the stroke mask). Column projections reveal the column structure of a
 * *borderless* table: the whitespace gutters between columns show up as long
 * near-zero runs even when no rule was ever drawn.
 *
 * 5M atomicAdds into ~2600 slots would serialise badly, so each 16x16
 * workgroup reduces into shared memory first and issues 16 global atomics per
 * axis instead of 256.
 *
 * bindings: 1 maskA, 2 maskB, 3 rowA, 4 colA, 5 rowB, 6 colB
 * ------------------------------------------------------------------ */
export const PROJECTIONS = wgsl(/* wgsl */ `
@group(0) @binding(1) var<storage, read> maskA : array<f32>;
@group(0) @binding(2) var<storage, read> maskB : array<f32>;
@group(0) @binding(3) var<storage, read_write> rowA : array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> colA : array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> rowB : array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> colB : array<atomic<u32>>;

var<workgroup> sRowA : array<atomic<u32>, 16>;
var<workgroup> sColA : array<atomic<u32>, 16>;
var<workgroup> sRowB : array<atomic<u32>, 16>;
var<workgroup> sColB : array<atomic<u32>, 16>;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid : vec3<u32>,
        @builtin(local_invocation_id) lid : vec3<u32>,
        @builtin(workgroup_id) wid : vec3<u32>) {

  if (lid.y == 0u) {
    atomicStore(&sRowA[lid.x], 0u);
    atomicStore(&sColA[lid.x], 0u);
    atomicStore(&sRowB[lid.x], 0u);
    atomicStore(&sColB[lid.x], 0u);
  }
  workgroupBarrier();

  // No early return: every invocation must reach both barriers.
  if (gid.x < P.w && gid.y < P.h) {
    let i = pxIndex(gid.x, gid.y);
    let a = u32(clamp(maskA[i], 0.0, 1.0) * 255.0 + 0.5);
    let b = u32(clamp(maskB[i], 0.0, 1.0) * 255.0 + 0.5);
    atomicAdd(&sRowA[lid.y], a);
    atomicAdd(&sColA[lid.x], a);
    atomicAdd(&sRowB[lid.y], b);
    atomicAdd(&sColB[lid.x], b);
  }
  workgroupBarrier();

  if (lid.y == 0u) {
    let gy = wid.y * 16u + lid.x;
    if (gy < P.h) {
      atomicAdd(&rowA[gy], atomicLoad(&sRowA[lid.x]));
      atomicAdd(&rowB[gy], atomicLoad(&sRowB[lid.x]));
    }
    let gx = wid.x * 16u + lid.x;
    if (gx < P.w) {
      atomicAdd(&colA[gx], atomicLoad(&sColA[lid.x]));
      atomicAdd(&colB[gx], atomicLoad(&sColB[lid.x]));
    }
  }
}
`);
