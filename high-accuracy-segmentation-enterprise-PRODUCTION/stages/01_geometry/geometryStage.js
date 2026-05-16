
export class GeometryStage {
    constructor(gpu) {
        this.gpu = gpu;
        this.name = "GeometryStage";
    }
    async execute() {
        console.log("Running geometry corrections...");
    }
}
