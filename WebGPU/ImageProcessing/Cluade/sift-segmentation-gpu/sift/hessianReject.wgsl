// sift/hessianReject.wgsl – inline Hessian edge-test (used inside extremaDetection shader)
// Not a standalone kernel; included here for reference.
// fn hessianReject(dog: texture_2d<f32>, x: i32, y: i32, edgeThresh: f32) -> bool
fn hessianReject(dog: texture_2d<f32>, x: i32, y: i32, edgeThresh: f32) -> bool {
  let dxx = textureLoad(dog, vec2<i32>(x+1,y),   0).r - 2.0*textureLoad(dog, vec2<i32>(x,y), 0).r + textureLoad(dog, vec2<i32>(x-1,y),   0).r;
  let dyy = textureLoad(dog, vec2<i32>(x,  y+1), 0).r - 2.0*textureLoad(dog, vec2<i32>(x,y), 0).r + textureLoad(dog, vec2<i32>(x,  y-1), 0).r;
  let dxy = (textureLoad(dog, vec2<i32>(x+1,y+1), 0).r - textureLoad(dog, vec2<i32>(x-1,y+1), 0).r
           - textureLoad(dog, vec2<i32>(x+1,y-1), 0).r + textureLoad(dog, vec2<i32>(x-1,y-1), 0).r) * 0.25;
  let trH  = dxx + dyy;
  let detH = dxx*dyy - dxy*dxy;
  if (detH <= 0.0) { return true; }
  return (trH*trH/detH) > ((edgeThresh+1.0)*(edgeThresh+1.0)/edgeThresh);
}
