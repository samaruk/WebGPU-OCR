# PaddleOCR-VL sidecar contract

The sidecar is a separate process. Nothing about Python, PaddlePaddle or CUDA
enters the host application — the host speaks JSON over HTTP to a URL:

```
InvoiceEngine (JS in browser)      InvoiceEngine.exe (.NET)
            │                                │
            │  HTTP/JSON                     │  HTTP or gRPC
            ▼                                ▼
     ┌──────────────────────────────────────────────┐
     │        paddleocr-vl service (Python)          │
     └──────────────────────────────────────────────┘
```

The service is only ever asked about **rectangles that GRIDLIFT and
InvoiceForensics could not settle between them**, never about whole pages.

---

## `GET /health`

```json
{ "ok": true, "model": "PaddleOCR-VL-0.9B", "device": "cuda:0", "queue": 0 }
```

## `POST /v1/parse`

### Request

| field    | type                              | notes |
|----------|-----------------------------------|-------|
| `task`   | `"ocr" \| "structure" \| "qa"`    | required |
| `image`  | base64 PNG, no `data:` prefix     | the crop, already upscaled by the client |
| `prompt` | string \| null                    | instruction for the VL head (`structure`/`qa`) |
| `meta`   | object                            | `roi` (source-image rect), `scale`, `role`, `kinds` |

```json
{
  "task": "ocr",
  "image": "iVBORw0KGgo...",
  "prompt": null,
  "meta": { "roi": { "x": 1180, "y": 940, "w": 260, "h": 44 }, "scale": 2.4, "role": "AMOUNT" }
}
```

### Response

```json
{
  "boxes": [
    { "x": 12, "y": 6, "w": 96, "h": 30, "text": "1,250.00", "confidence": 0.97 }
  ],
  "text": "1,250.00",
  "structure": null,
  "confidence": 0.97,
  "ms": 84
}
```

* `boxes` are in **crop** coordinates; the client maps them back to source
  coordinates using the `roi`/`scale` it sent. Returning `text` alone is
  acceptable — the client then attributes it to the whole ROI.
* `structure` is only expected for `task: "structure"`, and should be
  `{ "rows": [["cell", "cell", ...], ...] }`.
* `confidence` must be calibrated enough to be worth fusing. A model that
  always returns `1.0` will dominate the fusion for the wrong reasons.

### Errors

Return a non-2xx status with `{ "error": "..." }`. The client retries once on
transport failures, never on 4xx, and degrades to the geometry-only answer
rather than failing the whole invoice.

---

## Minimal reference server

```python
# pip install fastapi uvicorn pillow paddleocr
import base64, io, time
from fastapi import FastAPI
from pydantic import BaseModel
from PIL import Image

app = FastAPI()
pipeline = None  # load PaddleOCR-VL once at startup

class ParseRequest(BaseModel):
    task: str = "ocr"
    image: str
    prompt: str | None = None
    meta: dict = {}

@app.get("/health")
def health():
    return {"ok": True, "model": "PaddleOCR-VL", "queue": 0}

@app.post("/v1/parse")
def parse(req: ParseRequest):
    t0 = time.time()
    img = Image.open(io.BytesIO(base64.b64decode(req.image))).convert("RGB")

    result = pipeline.predict(img, task=req.task, prompt=req.prompt)

    boxes = [
        {
            "x": b["bbox"][0], "y": b["bbox"][1],
            "w": b["bbox"][2] - b["bbox"][0],
            "h": b["bbox"][3] - b["bbox"][1],
            "text": b["text"],
            "confidence": float(b["score"]),
        }
        for b in result.get("words", [])
    ]
    return {
        "boxes": boxes,
        "text": result.get("text", ""),
        "structure": result.get("table"),
        "confidence": float(result.get("score", 0.5)),
        "ms": int((time.time() - t0) * 1000),
    }
```

Run it next to the host, not inside it:

```
uvicorn server:app --host 127.0.0.1 --port 8760 --workers 1
```

---

## Cost discipline

The controller enforces, per invoice:

| budget            | default   | why |
|-------------------|-----------|-----|
| `acceptConfidence`| 0.90      | stop the moment the answer is good enough |
| `maxRois`         | 12        | a page has a handful of genuinely ambiguous cells, not hundreds |
| `maxPixels`       | 4 000 000 | a 12 MP page is ~3x this on its own |
| `maxMs`           | 15 000    | hard wall-clock ceiling |
| `waveSize`        | 4         | re-check confidence between waves; solving one cell often removes the need for the next |

A typical escalation is six crops of ~200x40 px — about 48 000 pixels, or 0.4%
of the page.
