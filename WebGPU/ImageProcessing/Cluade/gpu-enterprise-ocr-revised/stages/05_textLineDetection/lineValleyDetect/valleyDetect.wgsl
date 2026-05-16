
@group(0) @binding(0) var<storage,read>       projection:array<u32>;
@group(0) @binding(1) var<storage,read_write> valleyMask:array<u32>;
@group(0) @binding(2) var outputTex:texture_storage_2d<rgba8unorm,write>;
@group(0) @binding(3) var<uniform> u:vec4<u32>;
@group(0) @binding(4) var<uniform> uf:vec4<f32>;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
  let H=u.y;let W=u.x;if(gid.x>=H){return;}
  var maxP:u32=1u;
  for(var r:u32=0u;r<H;r++){if(projection[r]>maxP){maxP=projection[r];}}
  let row=gid.x;
  let isValley=projection[row]<=u32(f32(maxP)*uf.x);
  valleyMask[row]=select(0u,1u,isValley);
  let projNorm=f32(projection[row])/f32(maxP);
  let barW=u32(projNorm*f32(W));
  for(var col:u32=0u;col<W;col++){
    var c:vec4<f32>;
    if(isValley){c=vec4<f32>(.2,.5,1.,1.);}
    else if(col<barW){c=vec4<f32>(.2,.9,.4,1.);}
    else{c=vec4<f32>(.05,.05,.05,1.);}
    textureStore(outputTex,vec2<i32>(i32(col),i32(row)),c);
  }
}
