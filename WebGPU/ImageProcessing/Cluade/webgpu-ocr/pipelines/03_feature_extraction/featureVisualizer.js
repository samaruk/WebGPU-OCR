
import { displayHeatmap } from '../../utils/canvasDisplay.js';

export class FeatureVisualizer {
  async visualize({ mag, width, height }, canvas) {
    const data = await mag.download();
    displayHeatmap(data, width, height, canvas);
  }
}
