/**
 * Shared WGSL prelude. Every GRIDLIFT kernel binds the same uniform block at
 * @binding(0) so one bind-group shape covers the whole pipeline.
 *
 *   w, h            working resolution
 *   i0..i3          integer knobs (radius, axis, op, capacity, ...)
 *   f0..f3          float knobs (thresholds, gains, ...)
 */
export const PRELUDE = /* wgsl */ `
struct Params {
  w  : u32,
  h  : u32,
  i0 : u32,
  i1 : u32,
  i2 : u32,
  i3 : u32,
  f0 : f32,
  f1 : f32,
  f2 : f32,
  f3 : f32,
};
@group(0) @binding(0) var<uniform> P : Params;

const INVALID : u32 = 0xffffffffu;

fn pxIndex(x : u32, y : u32) -> u32 { return y * P.w + x; }

fn clampX(x : i32) -> u32 { return u32(clamp(x, 0, i32(P.w) - 1)); }
fn clampY(y : i32) -> u32 { return u32(clamp(y, 0, i32(P.h) - 1)); }

fn inside(x : i32, y : i32) -> bool {
  return x >= 0 && y >= 0 && x < i32(P.w) && y < i32(P.h);
}
`;

/** Convenience for composing a kernel with the prelude. */
export const wgsl = (body) => PRELUDE + body;
