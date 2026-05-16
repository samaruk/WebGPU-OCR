
import { displayGray, displayRGBA } from '../../utils/canvasDisplay.js';
import { CONFIG } from '../../config.js';

export class PreprocessVisualizer {
  async visualize({ gray, width, height }, canvas) {
    const data = await gray.download();
    displayGray(data, width, height, canvas);
  }
}
