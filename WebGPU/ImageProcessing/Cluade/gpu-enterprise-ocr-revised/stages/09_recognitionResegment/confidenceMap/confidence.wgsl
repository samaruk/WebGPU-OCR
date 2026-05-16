// Confidence map for touching character detection.
// Uses the SWT output texture (warm colormap: yellow=thin, red=thick strokes).
// A foreground pixel is "low confidence" (possible touch point) if:
//   its local 5×5 neighbourhood has mixed thin+thick strokes (transition zone).
// Output: .r=1 means low-confidence/touching, .rg=0 means normal text pixel.

@group(0) @binding(0) var swtTex   : texture_2d<f32>;
@group(0) @binding(1) var binaryTex : texture_2d<f32>;
@group(0) @binding(2) var outputTex : texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> u  : vec4<u32>;
@group(0) @binding(4) var<uniform> uf : vec4<f32>;

fn swtVal(x:i32, y:i32, W:i32, H:i32) -> f32 {
  // Extract stroke width from warm colormap: r=1 always, g=1-norm → norm = 1-g
  let c = textureLoad(swtTex, vec2<i32>(clamp(x,0,W-1), clamp(y,0,H-1)), 0);
  // If background (dark), return 0
  if (c.r < 0.3 && c.g < 0.3) { return 0.0; }
  return 1.0 - c.g;   // 0=thin stroke, 1=thick stroke
}

@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(u.x); let H = i32(u.y);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let x = i32(gid.x); let y = i32(gid.y);
  let fg = textureLoad(binaryTex, vec2<i32>(gid.xy), 0).r;

  if (fg < 0.5) {
    textureStore(outputTex, vec2<i32>(gid.xy), vec4<f32>(0.0,0.0,0.0,1.0));
    return;
  }

  // Sample 5×5 neighbourhood stroke widths
  var sum  = 0.0; var sum2 = 0.0; var cnt = 0.0;
  for (var dy = -2; dy <= 2; dy++) {
    for (var dx = -2; dx <= 2; dx++) {
      let v = swtVal(x+dx, y+dy, W, H);
      if (v > 0.0) { sum += v; sum2 += v*v; cnt += 1.0; }
    }
  }

  var lowConf = false;
  if (cnt > 2.0) {
    let mean = sum / cnt;
    let variance = sum2/cnt - mean*mean;
    let stddev = sqrt(max(variance, 0.0));
    // High coefficient of variation = mixed strokes = likely touch boundary
    let cv = stddev / max(mean, 0.001);
    lowConf = cv > uf.x;
  }

  // .r=1 .g=0 = low confidence (orange in resegment output)
  // .r=0 .g=1 = normal
  let lc = select(0.0, 1.0, lowConf);
  textureStore(outputTex, vec2<i32>(gid.xy), vec4<f32>(lc, 1.0-lc, 0.0, 1.0));
}
