
fn luminance(c:vec4<f32>)->f32{ return dot(c.rgb,vec3<f32>(.299,.587,.114)); }
fn safeNorm2(v:vec2<f32>)->vec2<f32>{let l=length(v);if(l<1e-6){return vec2<f32>(0.,0.);}return v/l;}
fn inBounds(x:i32,y:i32,w:i32,h:i32)->bool{return x>=0&&y>=0&&x<w&&y<h;}
fn hsv2rgb(h:f32,s:f32,v:f32)->vec3<f32>{
  let i=floor(h*6.);let f=h*6.-i;let p=v*(1.-s);let q=v*(1.-f*s);let t=v*(1.-(1.-f)*s);
  let r=i32(i)%6;
  if(r==0){return vec3<f32>(v,t,p);}if(r==1){return vec3<f32>(q,v,p);}
  if(r==2){return vec3<f32>(p,v,t);}if(r==3){return vec3<f32>(p,q,v);}
  if(r==4){return vec3<f32>(t,p,v);}return vec3<f32>(v,p,q);
}
