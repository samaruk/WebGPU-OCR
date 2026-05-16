
export class ThresholdStage {
    constructor(gpu) {
        this.gpu = gpu;
        this.name = "ThresholdStage";
    }
    async execute() {
        console.log("Applying adaptive threshold...");
    }
}
