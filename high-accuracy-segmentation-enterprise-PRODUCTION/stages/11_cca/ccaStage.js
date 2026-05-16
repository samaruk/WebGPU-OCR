
export class CCAStage {
    constructor(gpu) {
        this.gpu = gpu;
        this.name = "CCAStage";
    }
    async execute() {
        console.log("Running connected components...");
    }
}
