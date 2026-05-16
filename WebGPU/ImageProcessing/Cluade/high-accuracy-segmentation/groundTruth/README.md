# Ground Truth Annotation Format

## Overview
This directory defines the canonical annotation format for character segmentation benchmarking.
All dataset annotations used in `research/benchmarking.js` must conform to `schema.json`.

## Format Specification

```json
{
  "version": "1.0.0",
  "images": [
    {
      "id": "img_001",
      "url": "images/sample.png",
      "width": 1200,
      "height": 800,
      "dpi": 150,
      "language": "en",
      "degradation": "photocopy"
    }
  ],
  "annotations": [
    {
      "id": "ann_001",
      "imageId": "img_001",
      "label": "A",
      "bbox": [120, 45, 28, 42],
      "rotatedBbox": [134, 66, 30, 44, 2.5],
      "difficult": false
    }
  ]
}
```

## Fields

### Image
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | yes | Unique image identifier |
| url | string | yes | Relative URL to image file |
| width | integer | yes | Image width in pixels |
| height | integer | yes | Image height in pixels |
| dpi | number | no | Dots per inch (helps paramResolver) |
| language | string | no | ISO 639-1 language code |
| degradation | enum | no | Degradation profile name |

### Annotation
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | yes | Unique annotation identifier |
| imageId | string | yes | References image.id |
| label | string | no | Unicode character or category label |
| bbox | [x,y,w,h] | yes | Axis-aligned bounding box in pixels |
| rotatedBbox | [cx,cy,w,h,angle] | no | Rotated minimum-area rect |
| difficult | boolean | no | Mark ambiguous/occluded characters |

## Validation
Run `validator.js` on any dataset file before benchmarking:
```js
import { validateDataset } from "./validator.js";
const { valid, errors } = validateDataset(myData);
```
