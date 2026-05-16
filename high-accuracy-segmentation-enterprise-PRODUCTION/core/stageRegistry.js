
import { GeometryStage } from '../stages/01_geometry/geometryStage.js';
import { ThresholdStage } from '../stages/06_threshold/thresholdStage.js';
import { CCAStage } from '../stages/11_cca/ccaStage.js';

export class StageRegistry {
    constructor(gpu) {
        this.stages = [
            new GeometryStage(gpu),
            new ThresholdStage(gpu),
            new CCAStage(gpu)
        ];
    }
    getOrderedStages() { return this.stages; }
}
