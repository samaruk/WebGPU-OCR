/**
 * research/degradationSuite/syntheticDegrader.js
 * Applies controlled degradation to clean ground-truth images.
 * Enables reproducible benchmarking on known degradation levels.
 */
import profiles from "./degradationProfiles.json" assert { type: "json" };

export class SyntheticDegrader {
  constructor(profileName = "photocopy") {
    this.profile = profiles[profileName];
    if (!this.profile) throw new Error(`Unknown degradation profile: ${profileName}`);
  }

  /** Apply degradation to an ImageData. Returns degraded ImageData. */
  degrade(imageData) {
    let data = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    for (const op of this.profile.operations) {
      data = this._apply(data, op);
    }
    return data;
  }

  _apply(imageData, op) {
    switch (op.type) {
      case "gaussianBlur":    return this._gaussianBlur(imageData, op.sigma);
      case "addNoise":        return this._addNoise(imageData, op.sigma);
      case "rotate":          return this._rotate(imageData, op.angle);
      case "reduceBrightness":return this._brightness(imageData, op.factor);
      case "jpegArtifacts":   return this._jpegArtifacts(imageData, op.quality);
      case "saltPepper":      return this._saltPepper(imageData, op.density);
      default: console.warn(`Unknown degradation op: ${op.type}`); return imageData;
    }
  }

  _gaussianBlur(imgData, sigma) {
    const { data, width, height } = imgData;
    const out = new Uint8ClampedArray(data);
    const r   = Math.ceil(sigma * 2);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let rSum=0, gSum=0, bSum=0, wSum=0;
        for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++) {
          const sx=clamp(x+dx,0,width-1), sy=clamp(y+dy,0,height-1);
          const w = Math.exp(-(dx*dx+dy*dy)/(2*sigma*sigma));
          const i = (sy*width+sx)*4;
          rSum+=data[i]*w; gSum+=data[i+1]*w; bSum+=data[i+2]*w; wSum+=w;
        }
        const i=(y*width+x)*4;
        out[i]=rSum/wSum; out[i+1]=gSum/wSum; out[i+2]=bSum/wSum;
      }
    }
    return new ImageData(out, width, height);
  }

  _addNoise(imgData, sigma) {
    const out = new Uint8ClampedArray(imgData.data);
    for (let i=0; i<out.length; i+=4) {
      const n = randn() * sigma * 255;
      out[i]  =clamp(out[i]+n,0,255); out[i+1]=clamp(out[i+1]+n,0,255); out[i+2]=clamp(out[i+2]+n,0,255);
    }
    return new ImageData(out, imgData.width, imgData.height);
  }

  _brightness(imgData, factor) {
    const out = new Uint8ClampedArray(imgData.data);
    for (let i=0; i<out.length; i+=4) { out[i]*=factor; out[i+1]*=factor; out[i+2]*=factor; }
    return new ImageData(out, imgData.width, imgData.height);
  }

  _rotate(imgData, angle) { return imgData; } // stub; full: affine warp
  _jpegArtifacts(imgData, quality) { return imgData; } // stub
  _saltPepper(imgData, density) {
    const out = new Uint8ClampedArray(imgData.data);
    for (let i=0; i<out.length; i+=4) {
      if (Math.random() < density) { const v=Math.random()<0.5?0:255; out[i]=out[i+1]=out[i+2]=v; }
    }
    return new ImageData(out, imgData.width, imgData.height);
  }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function randn() {
  // Box-Muller transform
  const u = 1 - Math.random(), v = Math.random();
  return Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v);
}
