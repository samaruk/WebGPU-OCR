# WebGPU OCR Pipeline v2

15-stage GPU-accelerated OCR with per-stage canvas visualization.

## Quick Start
```bash
npm install
npm run dev
# Open http://localhost:5173
```
Requires Chrome 113+ / Edge 113+ with WebGPU enabled.

## Stages
| # | Stage | Compute |
|---|-------|---------|
|01|Image Decode|CPU|
|02|GPU Preprocess|**WGSL**: resize, normalize, grayscale|
|03|Backbone Inference|ONNX DBNet (WebGPU EP)|
|04|DB Postprocess|**WGSL**: binarize, morphology_open|
|05|Connected Components|**WGSL**: parallel label propagation|
|06|Polygon Refinement|CPU UnionFind + unclip|
|07|Layout Analysis|ONNX LayoutLMv3 / heuristic|
|08|Table Detection|ONNX Table Transformer|
|09|Crop & Warp|**WGSL**: perspective_warp per polygon|
|10|Recognition Router|CPU aspect/confidence routing|
|11|CRNN Inference|ONNX crnn_ctc (WASM EP)|
|12|PARSeq Inference|ONNX parseq_transformer (WebGPU EP)|
|13|CTC Decode|CPU beam search|
|14|LM Rescore|KenLM WASM / heuristic|
|15|Document Assembly|CPU structured JSON|

## Download
Click **⬇ Download All Stages** to get a ZIP of all 15 stage images + result.json + fulltext.txt.

## Models (place in `public/models/`)
- `detection/dbnet_mobilenetv3.onnx`
- `recognition/crnn_ctc.onnx`
- `recognition/parseq_transformer.onnx`
- `layout/layoutlmv3.onnx`
- `table/table_transformer.onnx`

All stages have CPU/synthetic fallbacks when models are absent.
