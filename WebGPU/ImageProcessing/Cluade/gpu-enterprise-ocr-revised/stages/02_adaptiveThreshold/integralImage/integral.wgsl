
// ─── Parallel prefix sum for integral image ───────────────────────────────
// Three entry points share this file:
//   scan_local   – each workgroup scans BLOCK=256 contiguous elements of one row/col
//   scan_blocks  – one thread per row/col accumulates block sums (serial over ~few blocks)
//   add_offset   – each workgroup adds its accumulated block offset back
//
// Row pass: dispatch(numBlocks, H)   where numBlocks = ceil(W/BLOCK)
// Col pass: dispatch(numBlocks, W)   where numBlocks = ceil(H/BLOCK)

const BLOCK: u32 = 256u;

var<workgroup> sh: array<f32, 256>;

struct ScanUniforms {
  W        : u32,   // image width
  H        : u32,   // image height
  numBlocks: u32,   // ceil(W/BLOCK) for row pass, ceil(H/BLOCK) for col pass
  pass     : u32,   // 0=row, 1=col
};
@group(0) @binding(3) var<uniform> su: ScanUniforms;

@group(0) @binding(0) var  srcTex    : texture_2d<f32>;         // original image (row pass)
@group(0) @binding(1) var  rowTex    : texture_storage_2d<r32float,write>; // row-scan output
@group(0) @binding(2) var<storage,read_write> blockSums : array<f32>;      // (numBlocksR * H) or (numBlocksC * W)

// ── PASS A: local Hillis-Steele inclusive scan within each block ───────────
@compute @workgroup_size(256)
fn scan_local(
  @builtin(workgroup_id)         wgid: vec3<u32>,
  @builtin(local_invocation_id)  lid : vec3<u32>,
) {
  let block = wgid.x;   // which block within the row/col
  let line  = wgid.y;   // which row (pass=0) or col (pass=1)
  let W = su.W; let H = su.H;

  let gpos = block * BLOCK + lid.x;  // global position in the row/col

  // Load: for row pass read pixel luminance; for col pass read row-scan result
  var val: f32 = 0.0;
  if (su.pass == 0u) {
    if (gpos < W) {
      let c = textureLoad(srcTex, vec2<i32>(i32(gpos), i32(line)), 0);
      val = dot(c.rgb, vec3<f32>(0.299, 0.587, 0.114));
    }
  } else {
    // col pass reads from a separate r32float texture bound at binding 4
  }
  sh[lid.x] = val;
  workgroupBarrier();

  // Hillis-Steele inclusive prefix sum
  var offset: u32 = 1u;
  loop {
    if (offset >= BLOCK) { break; }
    workgroupBarrier();
    let v = sh[lid.x];
    let prev = select(0.0, sh[lid.x - offset], lid.x >= offset);
    workgroupBarrier();
    sh[lid.x] = v + prev;
    offset <<= 1u;
  }
  workgroupBarrier();

  // Store local inclusive prefix sum
  if (su.pass == 0u && gpos < W) {
    textureStore(rowTex, vec2<i32>(i32(gpos), i32(line)), vec4<f32>(sh[lid.x],0.,0.,1.));
  }

  // Store block sum (last element) for phase B
  if (lid.x == BLOCK - 1u || gpos == (select(W,H,su.pass==1u) - 1u)) {
    blockSums[line * su.numBlocks + block] = sh[lid.x];
  }
}

// ── Row-pass col binding ─────────────────────────────────────────────────
@group(0) @binding(4) var rowScanTex: texture_2d<f32>;   // r32float (for col pass input)
@group(0) @binding(5) var colTex    : texture_storage_2d<r32float,write>;

// ── PASS A col variant ───────────────────────────────────────────────────
@compute @workgroup_size(256)
fn scan_local_col(
  @builtin(workgroup_id)        wgid: vec3<u32>,
  @builtin(local_invocation_id) lid : vec3<u32>,
) {
  let block = wgid.x;
  let col   = wgid.y;
  let H = su.H;

  let row = block * BLOCK + lid.x;
  var val: f32 = 0.0;
  if (row < H) {
    val = textureLoad(rowScanTex, vec2<i32>(i32(col), i32(row)), 0).r;
  }
  sh[lid.x] = val;
  workgroupBarrier();

  var offset: u32 = 1u;
  loop {
    if (offset >= BLOCK) { break; }
    workgroupBarrier();
    let v = sh[lid.x];
    let prev = select(0.0, sh[lid.x - offset], lid.x >= offset);
    workgroupBarrier();
    sh[lid.x] = v + prev;
    offset <<= 1u;
  }
  workgroupBarrier();

  if (row < H) {
    textureStore(colTex, vec2<i32>(i32(col), i32(row)), vec4<f32>(sh[lid.x],0.,0.,1.));
  }
  if (lid.x == BLOCK - 1u || row == H - 1u) {
    blockSums[col * su.numBlocks + block] = sh[lid.x];
  }
}

// ── PASS B: accumulate block offsets (one thread per row/col) ─────────────
@group(0) @binding(0) var<storage,read_write> blockSumsRW: array<f32>;
@group(0) @binding(1) var<uniform> su2: ScanUniforms;

@compute @workgroup_size(256)
fn accumulate_blocks(@builtin(global_invocation_id) gid: vec3<u32>) {
  let line = gid.x;
  let nLines = select(su2.H, su2.W, su2.pass == 1u);
  if (line >= nLines) { return; }
  var acc: f32 = 0.0;
  for (var b: u32 = 0u; b < su2.numBlocks; b++) {
    let idx = line * su2.numBlocks + b;
    let v   = blockSumsRW[idx];
    blockSumsRW[idx] = acc;   // store PREFIX offset for this block
    acc += v;
  }
}

// ── PASS C: add block offsets to stored local sums ────────────────────────
@group(0) @binding(0) var  inTex    : texture_2d<f32>;
@group(0) @binding(1) var  outTex   : texture_storage_2d<r32float,write>;
@group(0) @binding(2) var<storage,read> blockOffsets: array<f32>;
@group(0) @binding(3) var<uniform> su3: ScanUniforms;

@compute @workgroup_size(256)
fn add_offsets_row(
  @builtin(workgroup_id)        wgid: vec3<u32>,
  @builtin(local_invocation_id) lid : vec3<u32>,
) {
  let block = wgid.x; let row = wgid.y;
  let gpos  = block * BLOCK + lid.x;
  if (gpos >= su3.W) { return; }
  let local_sum = textureLoad(inTex, vec2<i32>(i32(gpos), i32(row)), 0).r;
  let offset    = blockOffsets[row * su3.numBlocks + block];
  textureStore(outTex, vec2<i32>(i32(gpos), i32(row)), vec4<f32>(local_sum + offset, 0., 0., 1.));
}

@compute @workgroup_size(256)
fn add_offsets_col(
  @builtin(workgroup_id)        wgid: vec3<u32>,
  @builtin(local_invocation_id) lid : vec3<u32>,
) {
  let block = wgid.x; let col = wgid.y;
  let gpos  = block * BLOCK + lid.x;
  if (gpos >= su3.H) { return; }
  let local_sum = textureLoad(inTex, vec2<i32>(i32(col), i32(gpos)), 0).r;
  let offset    = blockOffsets[col * su3.numBlocks + block];
  textureStore(outTex, vec2<i32>(i32(col), i32(gpos)), vec4<f32>(local_sum + offset, 0., 0., 1.));
}
