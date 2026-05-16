/**
 * sift/dog.js – computes Difference-of-Gaussians between consecutive pyramid scales.
 */
export class DoGBuilder {
  /**
   * @param {{ octaves: Array }} pyrResult – output of GaussianPyramid.build()
   * @returns {{ octaves: Array<{dogs: Float32Array[], width, height}> }}
   */
  static build(pyrResult) {
    return {
      octaves: pyrResult.octaves.map(octave => {
        const dogs = [];
        for (let s = 1; s < octave.scales.length; s++) {
          const a = octave.scales[s - 1].cpuData;
          const b = octave.scales[s].cpuData;
          const d = new Float32Array(a.length);
          for (let i = 0; i < a.length; i++) d[i] = (b[i] - a[i]) / 255;
          dogs.push(d);
        }
        return { dogs, width: octave.width, height: octave.height };
      }),
    };
  }
}
