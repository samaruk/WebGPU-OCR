// types.wgsl — shared WGSL struct definitions
struct ImageUni  { width:u32, height:u32, inv_w:f32, inv_h:f32 };
struct PyramidUni{ src_w:u32, src_h:u32, dst_w:u32, dst_h:u32, sigma:f32, radius:u32, _p0:u32, _p1:u32 };
struct Keypoint  { x:f32, y:f32, sigma:f32, angle:f32, octave:u32, layer:u32, resp:f32, _pad:f32 };
struct BBox      { min_x:u32, min_y:u32, max_x:u32, max_y:u32, area:u32, _p0:u32, _p1:u32, _p2:u32 };
