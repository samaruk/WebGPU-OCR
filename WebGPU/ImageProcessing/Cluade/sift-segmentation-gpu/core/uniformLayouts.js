/**
 * core/uniformLayouts.js – uniform struct packing utilities.
 */
export function packUniforms(fields) {
  const buf = new ArrayBuffer(Math.ceil(fields.length * 4 / 16) * 16);
  const f32 = new Float32Array(buf), u32 = new Uint32Array(buf), i32 = new Int32Array(buf);
  fields.forEach(([, type, val], i) => {
    if (type === 'f32') f32[i] = val; else if (type === 'u32') u32[i] = val; else i32[i] = val;
  });
  return buf;
}
export const makeImageUniforms   = (w, h) => packUniforms([['width','u32',w],['height','u32',h],['invW','f32',1/w],['invH','f32',1/h]]);
export const makeGaussianUniforms = (w, h, sigma, r) => packUniforms([['width','u32',w],['height','u32',h],['sigma','f32',sigma],['radius','u32',r]]);
export const makeSIFTUniforms     = (w, h, ct, et) => packUniforms([['width','u32',w],['height','u32',h],['contrastThresh','f32',ct],['edgeThresh','f32',et]]);
