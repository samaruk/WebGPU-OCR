// shaders/common/types.wgsl — Shared struct definitions

struct ImageUniforms {
  width  : u32,
  height : u32,
  inv_w  : f32,
  inv_h  : f32,
};

struct PyramidUniforms {
  width   : u32,
  height  : u32,
  octave  : u32,
  scale   : u32,
  sigma   : f32,
  inv_w   : f32,
  inv_h   : f32,
  _pad    : f32,
};

struct Keypoint {
  x         : f32,   // subpixel x
  y         : f32,   // subpixel y
  sigma     : f32,   // scale (absolute)
  angle     : f32,   // dominant orientation (radians)
  octave    : u32,
  layer     : u32,
  response  : f32,
  _pad      : f32,
};

struct Descriptor {
  data : array<f32, 128>,
};

struct ComponentMetric {
  label    : u32,
  area     : u32,
  min_x    : u32,
  min_y    : u32,
  max_x    : u32,
  max_y    : u32,
  cx       : f32,
  cy       : f32,
};

struct EdgeEntry {
  label_a  : u32,
  label_b  : u32,
  score    : f32,
  _pad     : u32,
};
