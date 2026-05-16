
@group(0) @binding(0) var<storage,read_write> labels:array<u32>;
@group(0) @binding(1) var<uniform> u:vec4<u32>;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
  if(gid.x>=u.x){return;}
  var lbl=labels[gid.x];if(lbl==0u){return;}
  for(var i=0;i<32;i++){
    let parent=labels[lbl-1u];
    if(parent==0u||parent==lbl){break;}
    lbl=parent;
  }
  labels[gid.x]=lbl;
}
