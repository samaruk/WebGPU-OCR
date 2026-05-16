/**
 * shaders.js — All WGSL compute shader source strings.
 *
 * WHY THIS FILE EXISTS:
 *   Keeping shader source separate from pipeline orchestration means you can
 *   read, modify, or replace any shader without touching the JS that dispatches
 *   it. Each shader is documented with its purpose and the exact GPU operation
 *   it performs.
 *
 * WGSL NOTES:
 *   - Storage pointer arguments (ptr<storage,...>) cannot be passed to helper
 *     functions in Naga (Chrome's compiler). Helpers must read module-scope
 *     bindings directly.
 *   - Comparison operators like >= inside select() arguments are parsed as
 *     generic-close tokens. Hoist to a `let bool` before the select() call.
 *   - All uniforms use a shared 16-byte struct: {w, h, p0, p1}.
 */

// Shared uniform block used by every shader.
// WHY ONE STRUCT: avoids duplicating the layout declaration in every shader
// string. The UB prefix is concatenated before each shader's WGSL code.
const UB = `struct U{w:u32,h:u32,p0:f32,p1:f32}\n`;

// ── 1. Grayscale ─────────────────────────────────────────────────────────────
// WHY: All downstream processing works on single-channel luminance values.
//      Colour information is irrelevant for text detection. Converting once
//      reduces memory bandwidth by 4× for every subsequent shader.
// INPUT:  array<u32>  — RGBA packed little-endian (R=bits0-7, G=8-15, B=16-23)
// OUTPUT: array<f32>  — luminance [0,1] using BT.601 weights
export const SH_GRAY = UB + `
@group(0)@binding(0)var<storage,read>src:array<u32>;
@group(0)@binding(1)var<storage,read_write>dst:array<f32>;
@group(0)@binding(2)var<uniform>u:U;
@compute@workgroup_size(16,16)fn main(@builtin(global_invocation_id)g:vec3<u32>){
  if(g.x>=u.w||g.y>=u.h){return;}
  let i=g.y*u.w+g.x; let v=src[i];
  dst[i]=.299*f32(v&255u)/255.+.587*f32((v>>8u)&255u)/255.+.114*f32((v>>16u)&255u)/255.;
}`;

// ── 2 & 3. Gaussian blur — horizontal and vertical passes ────────────────────
// WHY: Scanner noise and JPEG compression create salt-and-pepper artefacts.
//      Sauvola's local standard deviation reacts to these, producing
//      misclassified pixels. A mild Gaussian (σ≈1, 5 taps) suppresses
//      high-frequency noise without blurring text edges significantly.
// WHY SEPARABLE: A 2D Gaussian = H-pass * V-pass. Two 1D kernels of 5 taps
//      each = 10 multiplications per pixel vs 25 for a 5×5 2D kernel.
export const SH_BLH = UB + `
@group(0)@binding(0)var<storage,read>src:array<f32>;
@group(0)@binding(1)var<storage,read_write>dst:array<f32>;
@group(0)@binding(2)var<uniform>u:U;
@compute@workgroup_size(16,16)fn main(@builtin(global_invocation_id)g:vec3<u32>){
  if(g.x>=u.w||g.y>=u.h){return;}
  let x=i32(g.x);let w=i32(u.w);let row=g.y*u.w;
  dst[row+g.x]=.0545*src[row+u32(clamp(x-2,0,w-1))]+.2442*src[row+u32(clamp(x-1,0,w-1))]
              +.4026*src[row+g.x]+.2442*src[row+u32(clamp(x+1,0,w-1))]+.0545*src[row+u32(clamp(x+2,0,w-1))];
}`;

export const SH_BLV = UB + `
@group(0)@binding(0)var<storage,read>src:array<f32>;
@group(0)@binding(1)var<storage,read_write>dst:array<f32>;
@group(0)@binding(2)var<uniform>u:U;
@compute@workgroup_size(16,16)fn main(@builtin(global_invocation_id)g:vec3<u32>){
  if(g.x>=u.w||g.y>=u.h){return;}
  let y=i32(g.y);let h=i32(u.h);let W=u.w;let x=g.x;
  dst[g.y*W+x]=.0545*src[u32(clamp(y-2,0,h-1))*W+x]+.2442*src[u32(clamp(y-1,0,h-1))*W+x]
              +.4026*src[g.y*W+x]+.2442*src[u32(clamp(y+1,0,h-1))*W+x]+.0545*src[u32(clamp(y+2,0,h-1))*W+x];
}`;

// ── 4 & 5. Summed Area Table — row scan then column scan ─────────────────────
// WHY SAT: Sauvola needs mean and variance inside a W×W window for every pixel.
//      Naive: O(N * r²). SAT: build in O(N), query any rectangle in O(1).
//      For r=40, the SAT approach is ~40× faster.
// HOW: Row scan (one thread per row, sequential over columns) produces
//      row-wise prefix sums. Column scan (one thread per column) accumulates
//      those row sums into a full 2D SAT in place. Both gray and gray² are
//      computed in parallel in one dual-output pass (needed for variance).
// WHY ONE THREAD PER ROW/COLUMN: Prefix sums are inherently sequential.
//      Parallel prefix sum algorithms exist but add code complexity for
//      diminishing returns on CPU-readable buffer sizes.
export const SH_SAT_ROW = UB + `
@group(0)@binding(0)var<storage,read>src:array<f32>;
@group(0)@binding(1)var<storage,read_write>satS:array<f32>;
@group(0)@binding(2)var<storage,read_write>satSq:array<f32>;
@group(0)@binding(3)var<uniform>u:U;
@compute@workgroup_size(64,1)fn main(@builtin(global_invocation_id)g:vec3<u32>){
  let row=g.x; if(row>=u.h){return;}
  var cs=0.0;var csq=0.0;
  for(var x=0u;x<u.w;x++){
    let v=src[row*u.w+x]; cs+=v; csq+=v*v;
    satS[row*u.w+x]=cs; satSq[row*u.w+x]=csq;
  }
}`;

export const SH_SAT_COL = UB + `
@group(0)@binding(0)var<storage,read_write>satS:array<f32>;
@group(0)@binding(1)var<storage,read_write>satSq:array<f32>;
@group(0)@binding(2)var<uniform>u:U;
@compute@workgroup_size(64,1)fn main(@builtin(global_invocation_id)g:vec3<u32>){
  let col=g.x; if(col>=u.w){return;}
  var cs=0.0;var csq=0.0;
  for(var y=0u;y<u.h;y++){
    let i=y*u.w+col; cs+=satS[i]; csq+=satSq[i]; satS[i]=cs; satSq[i]=csq;
  }
}`;

// ── 6. Sauvola adaptive threshold using SAT ───────────────────────────────────
// WHY: Converts the grayscale image into a binary map: 1=text, 0=background.
//      Sauvola's formula T = mean*(1 + k*(σ/R - 1)) adapts the threshold to
//      local contrast. Regions with low σ (uniform background) get a high T
//      that rejects them. Regions with high σ (text/background boundary) get
//      a lower T that accepts the dark pixels as text.
// p0 = window radius, p1 = k factor (negative → invert output)
// SAT QUERY: area_sum = SAT[BR] - SAT[BL-1] - SAT[TR-1] + SAT[TL-1]
// NOTE: rdS/rdSq helpers read module-scope satS/satSq directly.
//       Cannot pass storage arrays as function pointer arguments in Naga.
// NOTE: comparison gv>=T is hoisted to `let belowT=(gv<T)` to avoid the
//       WGSL parser treating `>` as a generic-close token inside select().
export const SH_SAUVOLA = UB + `
@group(0)@binding(0)var<storage,read>gray:array<f32>;
@group(0)@binding(1)var<storage,read>satS:array<f32>;
@group(0)@binding(2)var<storage,read>satSq:array<f32>;
@group(0)@binding(3)var<storage,read_write>dst:array<f32>;
@group(0)@binding(4)var<uniform>u:U;
fn rdS(x:i32,y:i32)->f32{ if(x<0||y<0){return 0.;} return satS[u32(y)*u.w+u32(x)]; }
fn rdSq(x:i32,y:i32)->f32{ if(x<0||y<0){return 0.;} return satSq[u32(y)*u.w+u32(x)]; }
@compute@workgroup_size(16,16)fn main(@builtin(global_invocation_id)g:vec3<u32>){
  if(g.x>=u.w||g.y>=u.h){return;}
  let r=i32(u.p0); let kinv=u.p1; let k=abs(kinv); let inv=(kinv<0.);
  let ax1=max(0,i32(g.x)-r); let ay1=max(0,i32(g.y)-r);
  let ax2=min(i32(u.w)-1,i32(g.x)+r); let ay2=min(i32(u.h)-1,i32(g.y)+r);
  let ax1m=ax1-1; let ay1m=ay1-1;
  let cnt=f32((ax2-ax1+1)*(ay2-ay1+1));
  let qs=rdS(ax2,ay2)-select(0.,rdS(ax1m,ay2),ax1>0)
        -select(0.,rdS(ax2,ay1m),ay1>0)+select(0.,rdS(ax1m,ay1m),ax1>0&&ay1>0);
  let qsq=rdSq(ax2,ay2)-select(0.,rdSq(ax1m,ay2),ax1>0)
         -select(0.,rdSq(ax2,ay1m),ay1>0)+select(0.,rdSq(ax1m,ay1m),ax1>0&&ay1>0);
  let mean=qs/cnt;
  let sigma=sqrt(max(0.,qsq/cnt-mean*mean));
  let T=mean*(1.+k*(sigma/.5-1.));
  let gv=gray[g.y*u.w+g.x];
  let belowT=(gv<T);
  dst[g.y*u.w+g.x]=select(0.,1.,select(belowT,!belowT,inv));
}`;

// ── 7. Bilinear rotation ──────────────────────────────────────────────────────
// WHY: After skew detection, we rotate the blurred grayscale image so text
//      lines become horizontal. Every downstream step (dilation, CCA, skeleton)
//      assumes horizontal text. Correcting before binarization avoids having
//      to rotate the binary image (which would introduce aliasing).
// HOW: Inverse mapping — for each output pixel (ox,oy) compute where it came
//      from in the input via inverse rotation, then bilinear sample.
//      Out-of-bounds pixels return 1.0 (white paper background) so Sauvola
//      classifies the exposed corners as background, not text.
// p0 = cos(skewAngle), p1 = sin(skewAngle)
export const SH_ROTATE = UB + `
@group(0)@binding(0)var<storage,read>src:array<f32>;
@group(0)@binding(1)var<storage,read_write>dst:array<f32>;
@group(0)@binding(2)var<uniform>u:U;
@compute@workgroup_size(16,16)fn main(@builtin(global_invocation_id)g:vec3<u32>){
  if(g.x>=u.w||g.y>=u.h){return;}
  let cx=f32(u.w)*.5; let cy=f32(u.h)*.5;
  let dx=f32(g.x)-cx; let dy=f32(g.y)-cy;
  let c=u.p0; let s=u.p1;
  let ix=cx+dx*c+dy*s; let iy=cy-dx*s+dy*c;
  if(ix<0.||iy<0.||ix>=f32(u.w)||iy>=f32(u.h)){dst[g.y*u.w+g.x]=1.;return;}
  let x0=i32(floor(ix)); let y0=i32(floor(iy));
  let fx=ix-f32(x0); let fy=iy-f32(y0);
  let W=i32(u.w); let H=i32(u.h);
  let cx0=u32(clamp(x0,0,W-1)); let cx1=u32(clamp(x0+1,0,W-1));
  let cy0=u32(clamp(y0,0,H-1)); let cy1=u32(clamp(y0+1,0,H-1));
  dst[g.y*u.w+g.x]=mix(mix(src[cy0*u.w+cx0],src[cy0*u.w+cx1],fx),
                        mix(src[cy1*u.w+cx0],src[cy1*u.w+cx1],fx),fy);
}`;

// ── 8 & 9. Morphological dilation — horizontal then vertical ─────────────────
// WHY: The binary image has isolated character blobs separated by gaps.
//      Dilation (max-pooling over a 1D window) expands each blob outward until
//      adjacent blobs merge. Horizontal dilation bridges word gaps within a line.
//      Vertical dilation closes small within-character vertical gaps and adds
//      enough height for CCA to connect characters whose bounding boxes
//      nearly-but-don't-quite touch vertically.
// WHY SEPARABLE (H then V): Same benefit as blur — O(r) instead of O(r²).
// p0 = radius in pixels
export const SH_DILH = UB + `
@group(0)@binding(0)var<storage,read>src:array<f32>;
@group(0)@binding(1)var<storage,read_write>dst:array<f32>;
@group(0)@binding(2)var<uniform>u:U;
@compute@workgroup_size(16,16)fn main(@builtin(global_invocation_id)g:vec3<u32>){
  if(g.x>=u.w||g.y>=u.h){return;}
  let x=i32(g.x);let w=i32(u.w);let r=i32(u.p0);
  var mx=0.;
  for(var k=-r;k<=r;k++){mx=max(mx,src[g.y*u.w+u32(clamp(x+k,0,w-1))]);}
  dst[g.y*u.w+g.x]=mx;
}`;

export const SH_DILV = UB + `
@group(0)@binding(0)var<storage,read>src:array<f32>;
@group(0)@binding(1)var<storage,read_write>dst:array<f32>;
@group(0)@binding(2)var<uniform>u:U;
@compute@workgroup_size(16,16)fn main(@builtin(global_invocation_id)g:vec3<u32>){
  if(g.x>=u.w||g.y>=u.h){return;}
  let y=i32(g.y);let h=i32(u.h);let r=i32(u.p0);
  var mx=0.;
  for(var k=-r;k<=r;k++){mx=max(mx,src[u32(clamp(y+k,0,h-1))*u.w+g.x]);}
  dst[g.y*u.w+g.x]=mx;
}`;

// ── 10. Zhang-Suen thinning — both sub-iterations in one shader ───────────────
// WHY: The dilated line blobs are thick bands (height ≈ text height + dilation).
//      The skeleton graph requires a 1-pixel-wide medial axis to:
//        a) Determine the dominant line direction (PCA on skeleton points).
//        b) Find start and end of each line (graph diameter via 2-sweep BFS).
//      Zhang-Suen removes border pixels that are structurally redundant for
//      8-connectivity, iterating until no more pixels can be removed.
// WHY PING-PONG BUFFERS (A→B sub1, B→A sub2):
//      Each sub-iteration must see the state from the previous sub-iteration,
//      not partially-updated state. Writing to a different buffer ensures all
//      threads read consistent input. All iterations are submitted in one
//      GPU command to avoid round-trips.
// p0 = 0 → sub-iteration 1   p0 = 1 → sub-iteration 2
// WGSL NOTE: nb() reads module-scope src directly — no ptr<storage> argument.
export const SH_ZS = UB + `
@group(0)@binding(0)var<storage,read>src:array<f32>;
@group(0)@binding(1)var<storage,read_write>dst:array<f32>;
@group(0)@binding(2)var<uniform>u:U;
fn nb(xi:i32,yi:i32)->f32{
  if(xi<0||yi<0||u32(xi)>=u.w||u32(yi)>=u.h){return 0.;}
  return src[u32(yi)*u.w+u32(xi)];
}
@compute@workgroup_size(16,16)fn main(@builtin(global_invocation_id)g:vec3<u32>){
  if(g.x>=u.w||g.y>=u.h){return;}
  let idx=g.y*u.w+g.x; let p1=src[idx]; if(p1<.5){dst[idx]=0.;return;}
  let x=i32(g.x);let y=i32(g.y);
  let p2=nb(x,y-1);let p3=nb(x+1,y-1);let p4=nb(x+1,y);let p5=nb(x+1,y+1);
  let p6=nb(x,y+1);let p7=nb(x-1,y+1);let p8=nb(x-1,y);let p9=nb(x-1,y-1);
  let B=u32(p2>=.5)+u32(p3>=.5)+u32(p4>=.5)+u32(p5>=.5)+u32(p6>=.5)+u32(p7>=.5)+u32(p8>=.5)+u32(p9>=.5);
  if(B<2u||B>6u){dst[idx]=p1;return;}
  var A=0u;
  if(p2<.5&&p3>=.5){A++;}if(p3<.5&&p4>=.5){A++;}if(p4<.5&&p5>=.5){A++;}if(p5<.5&&p6>=.5){A++;}
  if(p6<.5&&p7>=.5){A++;}if(p7<.5&&p8>=.5){A++;}if(p8<.5&&p9>=.5){A++;}if(p9<.5&&p2>=.5){A++;}
  if(A!=1u){dst[idx]=p1;return;}
  var del=false;
  if(u.p0<.5){del=(p2<.5||p4<.5||p6<.5)&&(p4<.5||p6<.5||p8<.5);}
  else{del=(p2<.5||p4<.5||p8<.5)&&(p2<.5||p6<.5||p8<.5);}
  dst[idx]=select(p1,0.,del);
}`;

// ── 11 & 12 & 13. Jump Flooding Algorithm — distance transform ───────────────
// WHY: The distance transform gives, for every pixel, the distance to the
//      nearest background pixel. This is kept for visualisation (the DIST TRANSFORM
//      stage canvas) and could be used for per-point height estimation if the
//      vertical-scan CPU method ever needs a fallback.
// HOW (JFA): Seed background pixels with their own coordinates. Then run
//      log2(maxDim) passes, each halving the jump step. In each pass every pixel
//      looks at its 9 neighbours offset by ±step and adopts the closest known seed.
//      After all passes, dist = sqrt((x-seedX)² + (y-seedY)²).
// WHY JFA OVER EXACT EDT: JFA is GPU-parallel (all passes are embarrassingly
//      parallel). Exact EDT algorithms (Felzenszwalb, Meijster) require sequential
//      scans. JFA converges in O(N log N) on GPU vs O(N) sequentially — still
//      faster for large images because GPU parallelism compensates.
export const SH_JFA_INIT = UB + `
@group(0)@binding(0)var<storage,read>bin:array<f32>;
@group(0)@binding(1)var<storage,read_write>seedX:array<f32>;
@group(0)@binding(2)var<storage,read_write>seedY:array<f32>;
@group(0)@binding(3)var<uniform>u:U;
@compute@workgroup_size(16,16)fn main(@builtin(global_invocation_id)g:vec3<u32>){
  if(g.x>=u.w||g.y>=u.h){return;}
  let i=g.y*u.w+g.x;
  if(bin[i]<.5){seedX[i]=f32(g.x);seedY[i]=f32(g.y);}
  else{seedX[i]=-1.;seedY[i]=-1.;}
}`;

export const SH_JFA_STEP = UB + `
@group(0)@binding(0)var<storage,read>srcX:array<f32>;
@group(0)@binding(1)var<storage,read>srcY:array<f32>;
@group(0)@binding(2)var<storage,read_write>dstX:array<f32>;
@group(0)@binding(3)var<storage,read_write>dstY:array<f32>;
@group(0)@binding(4)var<uniform>u:U;
@compute@workgroup_size(16,16)fn main(@builtin(global_invocation_id)g:vec3<u32>){
  if(g.x>=u.w||g.y>=u.h){return;}
  let step=i32(u.p0);let x=i32(g.x);let y=i32(g.y);let i=g.y*u.w+g.x;
  var bx=srcX[i];var by=srcY[i];
  var bd=select(1e18,(f32(x)-bx)*(f32(x)-bx)+(f32(y)-by)*(f32(y)-by),bx>=0.);
  for(var dy=-1;dy<=1;dy++){for(var dx=-1;dx<=1;dx++){
    let nx=x+dx*step;let ny=y+dy*step;
    if(nx<0||ny<0||u32(nx)>=u.w||u32(ny)>=u.h){continue;}
    let ni=u32(ny)*u.w+u32(nx);
    let sx=srcX[ni];if(sx<0.){continue;}
    let sy=srcY[ni];
    let d=(f32(x)-sx)*(f32(x)-sx)+(f32(y)-sy)*(f32(y)-sy);
    if(d<bd){bd=d;bx=sx;by=sy;}
  }}
  dstX[i]=bx;dstY[i]=by;
}`;

export const SH_DIST = UB + `
@group(0)@binding(0)var<storage,read>seedX:array<f32>;
@group(0)@binding(1)var<storage,read>seedY:array<f32>;
@group(0)@binding(2)var<storage,read_write>dst:array<f32>;
@group(0)@binding(3)var<uniform>u:U;
@compute@workgroup_size(16,16)fn main(@builtin(global_invocation_id)g:vec3<u32>){
  if(g.x>=u.w||g.y>=u.h){return;}
  let i=g.y*u.w+g.x;let sx=seedX[i];let sy=seedY[i];
  dst[i]=select(0.,sqrt((f32(g.x)-sx)*(f32(g.x)-sx)+(f32(g.y)-sy)*(f32(g.y)-sy)),sx>=0.);
}`;
