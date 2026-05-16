// General matrix multiply C[M,N] = A[M,K] * B[K,N]
struct Uniforms { M:u32, K:u32, N:u32, _p:u32, }
@group(0) @binding(0) var<storage, read>       A   : array<f32>;
@group(0) @binding(1) var<storage, read>       B   : array<f32>;
@group(0) @binding(2) var<storage, read_write> C   : array<f32>;
@group(0) @binding(3) var<uniform>             uni : Uniforms;

var<workgroup> tileA : array<f32, 256>;  // 16x16 tile
var<workgroup> tileB : array<f32, 256>;
const TILE:u32 = 16u;

@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid:vec3<u32>,
        @builtin(local_invocation_id)  lid:vec3<u32>,
        @builtin(workgroup_id)         wid:vec3<u32>) {
  let row=gid.y; let col=gid.x;
  var sum=0.0;
  let numTiles=(uni.K+TILE-1u)/TILE;
  for(var t=0u;t<numTiles;t++){
    let aCol=t*TILE+lid.x; let bRow=t*TILE+lid.y;
    tileA[lid.y*TILE+lid.x]=select(0.0,A[row*uni.K+aCol],row<uni.M&&aCol<uni.K);
    tileB[lid.y*TILE+lid.x]=select(0.0,B[bRow*uni.N+col],bRow<uni.K&&col<uni.N);
    workgroupBarrier();
    for(var k=0u;k<TILE;k++){sum+=tileA[lid.y*TILE+k]*tileB[k*TILE+lid.x];}
    workgroupBarrier();
  }
  if(row<uni.M&&col<uni.N){C[row*uni.N+col]=sum;}
}