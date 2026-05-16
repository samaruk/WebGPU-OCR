// shaders/common/math.wgsl — Math utilities

const PI      : f32 = 3.14159265358979323846;
const TWO_PI  : f32 = 6.28318530717958647692;
const SQRT2   : f32 = 1.41421356237309504880;
const INV_SQRT2: f32 = 0.70710678118654752440;

fn gaussian1d(x: f32, sigma: f32) -> f32 {
  let inv2s2 = 1.0 / (2.0 * sigma * sigma);
  return exp(-x * x * inv2s2);
}

fn gaussian2d(x: f32, y: f32, sigma: f32) -> f32 {
  let inv2s2 = 1.0 / (2.0 * sigma * sigma);
  return exp(-(x*x + y*y) * inv2s2);
}

fn safe_div(a: f32, b: f32) -> f32 {
  return select(0.0, a / b, abs(b) > 1e-10);
}

fn clamp01(v: f32) -> f32 { return clamp(v, 0.0, 1.0); }

fn fract_floor(v: f32) -> vec2<f32> {
  let f = floor(v);
  return vec2<f32>(f, v - f);
}

// Fast atan2 approximation (max error ~0.0015 rad)
fn fast_atan2(y: f32, x: f32) -> f32 {
  let ay = abs(y);
  let ax = abs(x);
  let z  = select(ay / ax, ax / ay, ax >= ay);
  var a  = z * (PI / 4.0 - (z - 1.0) * (0.2447 + 0.0663 * z));
  a = select(PI / 2.0 - a, a, ax >= ay);
  a = select(PI - a, a, x < 0.0);
  a = select(-a, a, y >= 0.0);
  return a;
}

// Normalise an angle into [0, 2*PI)
fn norm_angle(a: f32) -> f32 {
  var v = a % TWO_PI;
  if (v < 0.0) { v += TWO_PI; }
  return v;
}

// 3x3 determinant
fn det3(m: mat3x3<f32>) -> f32 {
  return m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])
       - m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])
       + m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
}
