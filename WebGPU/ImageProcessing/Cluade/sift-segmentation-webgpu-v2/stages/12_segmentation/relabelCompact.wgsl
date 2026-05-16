// relabelCompact.wgsl — compact root labels to [1..N]
struct Uni { n:u32, max_lbl:u32, _p0:u32, _p1:u32 };
@group(0) @binding(0) var<uniform>            u    :Uni;
@group(0) @binding(1) var<storage,read>       lbl  :array<u32>;
@group(0) @binding(2) var<storage,read_write> remap:array<atomic<u32>>;
@group(0) @binding(3) var<storage,read_write> ctr  :atomic<u32>;
@group(0) @binding(4) var<storage,read_write> out  :array<u32>;
@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.n){return;}
  let l=lbl[gid.x]; if(l==0u){out[gid.x]=0u;return;}
  var mapped=atomicLoad(&remap[l%u.max_lbl]);
  if(mapped==0u){
    let nid=atomicAdd(&ctr,1u)+1u;
    atomicCompareExchangeWeak(&remap[l%u.max_lbl],0u,nid);
    mapped=atomicLoad(&remap[l%u.max_lbl]);
  }
  out[gid.x]=mapped;
}
