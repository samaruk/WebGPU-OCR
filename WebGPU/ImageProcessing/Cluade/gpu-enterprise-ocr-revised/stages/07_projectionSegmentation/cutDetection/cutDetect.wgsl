
@group(0)@binding(0) var<storage,read>       projection:array<u32>;
@group(0)@binding(1) var<storage,read_write> cuts:array<u32>;
@group(0)@binding(2) var outputTex:texture_storage_2d<rgba8unorm,write>;
@group(0)@binding(3) var<uniform> u:vec4<u32>;
@group(0)@binding(4) var<uniform> uf:vec4<f32>;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
  let W=u.x;let H=u.y;if(gid.x>=W){return;}
  let col=gid.x;var maxP:u32=1u;
  for(var c:u32=0u;c<W;c++){if(projection[c]>maxP){maxP=projection[c];}}
  let isCut=projection[col]<=u32(f32(maxP)*uf.x);
  cuts[col]=select(0u,1u,isCut);
  let barH=u32(f32(H)*f32(projection[col])/f32(maxP));
  for(var row:u32=0u;row<H;row++){
    var c:vec4<f32>;
    if(isCut){c=vec4<f32>(1.,.3,.2,1.);}
    else if(row>=H-barH){c=vec4<f32>(.9,.8,.2,1.);}
    else{c=vec4<f32>(.05,.05,.05,1.);}
    textureStore(outputTex,vec2<i32>(i32(col),i32(row)),c);
  }
}
