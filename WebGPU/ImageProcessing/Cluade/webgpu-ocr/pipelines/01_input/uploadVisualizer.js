
import { displayRGBA } from '../../utils/canvasDisplay.js';

export class UploadVisualizer {
  async visualize(stageResult, canvas) {
    const { rgbaTensor, width, height } = stageResult;
    const data = await rgbaTensor.download();
    displayRGBA(data, width, height, canvas);
  }
}
