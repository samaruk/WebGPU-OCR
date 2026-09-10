"""EasyOCR sidecar for InvoiceOcrApi.

Started once by the .NET service. Loads the reader, prints one JSON line
    {"ready": true, "version": "...", "ms": ...}        (or {"ready": false, "error": "..."})
and then answers every request line  {"path": "<image file>"}  with one line
    {"ok": true, "ms": ..., "items": [{"box": [[x,y],[x,y],[x,y],[x,y]], "text": "...", "conf": 0.98}, ...]}
or  {"ok": false, "error": "..."}.
Install the library with:  pip install easyocr   (PyTorch comes with it; the
detection and recognition models download on the first start).
"""
import argparse
import json
import sys
import time


def out(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--langs", default="en")
    ap.add_argument("--gpu", default="0")
    ap.add_argument("--threads", default="0", help="CPU torch threads (0 = torch's default)")
    ap.add_argument("--canvas", default="2560", help="detector canvas: the long side the page is shrunk to for detection")
    ap.add_argument("--batch", default="1", help="recognition batch size")
    args = ap.parse_args()
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    t0 = time.time()
    try:
        import easyocr  # noqa: F401
    except Exception as e:  # ModuleNotFoundError, a broken torch install, …
        out({"ready": False, "error": f"{type(e).__name__}: {e} — install it with: pip install easyocr"})
        return
    try:
        langs = [s.strip() for s in args.langs.split(",") if s.strip()] or ["en"]
        try:
            import torch
            n = int(args.threads)
            if n > 0:
                torch.set_num_threads(n)
        except Exception:
            pass
        reader = easyocr.Reader(langs, gpu=args.gpu not in ("0", "false", "False", ""), verbose=False)
        canvas = max(640, int(args.canvas)); batch = max(1, int(args.batch))
    except Exception as e:
        out({"ready": False, "error": f"EasyOCR could not load its models: {type(e).__name__}: {e}"})
        return
    out({"ready": True, "version": getattr(easyocr, "__version__", ""), "ms": int((time.time() - t0) * 1000), "langs": langs})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            path = req["path"]
            t = time.time()
            # detail=1: (box, text, confidence) per fragment; paragraph=False keeps fragments apart
            boxes = req.get("boxes")
            if boxes:
                # RECOGNITION ONLY inside the boxes another detector found (PaddleOCR's
                # regions): EasyOCR's own detector (CRAFT) is what costs most of its
                # time on a CPU — 40 s on a 2560 px page — and the two detectors find
                # the same regions; the reading stays an independent second opinion.
                # horizontal_list wants [x_min, x_max, y_min, y_max] per box.
                hl = [[int(b[0]), int(b[2]), int(b[1]), int(b[3])] for b in boxes if int(b[2]) > int(b[0]) and int(b[3]) > int(b[1])]
                result = reader.recognize(path, horizontal_list=hl, free_list=[], detail=1, paragraph=False, batch_size=batch)
            else:
                # canvas_size: detection on a shrunk copy; the crops are read from the full
                # image. batch_size: the crops go through the recogniser in batches.
                result = reader.readtext(path, detail=1, paragraph=False, canvas_size=canvas, mag_ratio=1.0, batch_size=batch)
            items = []
            for box, text, conf in result:
                items.append({"box": [[float(p[0]), float(p[1])] for p in box], "text": str(text), "conf": float(conf)})
            out({"ok": True, "ms": int((time.time() - t) * 1000), "items": items})
        except Exception as e:
            out({"ok": False, "error": f"{type(e).__name__}: {e}"})


if __name__ == "__main__":
    main()
