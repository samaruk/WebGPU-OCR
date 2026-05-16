// Top-level OCR pipeline orchestrator
import { EventBus, EVENTS } from "./EventBus.js";
import { PipelineRunner }   from "./PipelineRunner.js";
import { StageRegistry }    from "./StageRegistry.js";
import { StageRouter }      from "./StageRouter.js";
import { BufferManager }    from "./BufferManager.js";
import PIPELINE_CONFIG      from "../config/pipelineConfig.js";

// Stage imports
import Stage01 from "../stages/stage01_image_decode.js";
import Stage02 from "../stages/stage02_gpu_preprocess.js";
import Stage03 from "../stages/stage03_backbone_inference.js";
import Stage04 from "../stages/stage04_db_postprocess.js";
import Stage05 from "../stages/stage05_gpu_connected_components.js";
import Stage06 from "../stages/stage06_polygon_refine.js";
import Stage07 from "../stages/stage07_layout_analysis.js";
import Stage08 from "../stages/stage08_table_detection.js";
import Stage09 from "../stages/stage09_crop_warp.js";
import Stage10 from "../stages/stage10_recognition_router.js";
import Stage11 from "../stages/stage11_crnn_inference.js";
import Stage12 from "../stages/stage12_parseq_inference.js";
import Stage13 from "../stages/stage13_ctc_decode.js";
import Stage14 from "../stages/stage14_lm_rescore.js";
import Stage15 from "../stages/stage15_document_assembly.js";

export class OCRPipeline {
  constructor(gpuCtx) {
    this.gpuCtx  = gpuCtx;
    this.bus     = new EventBus();
    this.config  = PIPELINE_CONFIG;
    this.router  = new StageRouter(this.config);
    this.bufMgr  = new BufferManager(gpuCtx.device);
    this.registry = new StageRegistry();
    this._registerStages();
    this.runner  = new PipelineRunner(this.registry, this.bus);
  }

  _registerStages() {
    const stages = [
      { id:"stage01", label:"Image Decode",          cls:Stage01, inputs:[],             outputs:["rawImage","imageMeta"] },
      { id:"stage02", label:"GPU Preprocess",         cls:Stage02, inputs:["rawImage"],   outputs:["normTensor","grayTensor"] },
      { id:"stage03", label:"Backbone Inference",     cls:Stage03, inputs:["normTensor"], outputs:["probMap","threshMap"] },
      { id:"stage04", label:"DB Postprocess",         cls:Stage04, inputs:["probMap","threshMap"], outputs:["binMap"] },
      { id:"stage05", label:"Connected Components",   cls:Stage05, inputs:["binMap"],     outputs:["labelMap"] },
      { id:"stage06", label:"Polygon Refinement",     cls:Stage06, inputs:["labelMap"],   outputs:["polygons"] },
      { id:"stage07", label:"Layout Analysis",        cls:Stage07, inputs:["rawImage","polygons"], outputs:["layoutBlocks"] },
      { id:"stage08", label:"Table Detection",        cls:Stage08, inputs:["rawImage","layoutBlocks"], outputs:["tableStructures"] },
      { id:"stage09", label:"Crop & Warp",            cls:Stage09, inputs:["grayTensor","polygons"], outputs:["cropBatch"] },
      { id:"stage10", label:"Recognition Router",     cls:Stage10, inputs:["cropBatch"],  outputs:["crnnCrops","parseqCrops"] },
      { id:"stage11", label:"CRNN Inference",         cls:Stage11, inputs:["crnnCrops"],  outputs:["crnnLogits"] },
      { id:"stage12", label:"PARSeq Inference",       cls:Stage12, inputs:["parseqCrops"], outputs:["parseqTokens"] },
      { id:"stage13", label:"CTC Decode",             cls:Stage13, inputs:["crnnLogits","parseqTokens"], outputs:["rawTexts"] },
      { id:"stage14", label:"LM Rescore",             cls:Stage14, inputs:["rawTexts"],   outputs:["correctedTexts"] },
      { id:"stage15", label:"Document Assembly",      cls:Stage15, inputs:["correctedTexts","layoutBlocks","tableStructures","polygons"], outputs:["document"] },
    ];
    for (const s of stages) {
      this.registry.register(s.id, {
        label: s.label,
        inputs: s.inputs, outputs: s.outputs,
        enabled: this.config.stages[`${s.id}_${s.label.toLowerCase().replace(/\s+/g,"_")}`]?.enabled ?? true,
        execute: (ctx) => new s.cls(ctx).execute(),
      });
    }
  }

  on(event, cb) { return this.bus.on(event, cb); }

  async run(imageFile, canvasMap) {
    const context = {
      gpuCtx:   this.gpuCtx,
      bufMgr:   this.bufMgr,
      config:   this.config,
      router:   this.router,
      bus:      this.bus,
      canvases: canvasMap,   // stageId → HTMLCanvasElement
      data:     {},          // inter-stage data store
      imageFile,
    };
    return this.runner.run(context);
  }
}