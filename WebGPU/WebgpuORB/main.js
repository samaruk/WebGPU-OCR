import { initGPU } from "./gpuContext.js";
import { buildPyramid } from "./pyramid.js";
import { sobelHarris } from "./sobelHarris.js";
import { nonMaxSuppression } from "./nms.js";
import { compactKeypoints } from "./prefixCompaction.js";
import { radixSort } from "./radixSort.js";
import { selectTopK } from "./topK.js";
import { computeOrientation } from "./orientation.js";
import { computeBRIEF } from "./brief.js";
import { drawKeypoints } from "./draw.js";

const canvas = document.getElementById("canvas");
const { device, context } = await initGPU(canvas);

// Upload image → texture
const srcTex = /* image upload logic */;

// Pipeline
const pyramid = buildPyramid(device, srcTex, 4);
const response = sobelHarris(device, pyramid[0]);
const nms = nonMaxSuppression(device, response);
const { keypointBuffer, countBuffer } = compactKeypoints(device, nms);
const sorted = radixSort(device, keypointBuffer);
const topK = selectTopK(device, sorted, 500);
const oriented = computeOrientation(device, topK, srcTex);
const descriptors = computeBRIEF(device, oriented, srcTex);

// Draw
drawKeypoints(device, context, srcTex, oriented);
