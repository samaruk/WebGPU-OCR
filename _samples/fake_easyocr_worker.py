"""Stand-in for easyocr_worker.py when EasyOCR is not installed: speaks the
same one-line JSON protocol but reads the page with tesseract.exe in sparse
mode (psm 11), so the .NET EasyOcrEngine path can be exercised end to end.
Point Ocr:EasyOcr:Script at this file (or pass it on the command line)."""
import json, subprocess, sys, time

EXE = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


def out(o):
    sys.stdout.write(json.dumps(o) + "\n"); sys.stdout.flush()


def main():
    t0 = time.time()
    out({"ready": True, "version": "fake-tesseract-psm11", "ms": int((time.time() - t0) * 1000)})
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            path = json.loads(line)["path"]
            t = time.time()
            tsv = subprocess.run([EXE, path, "stdout", "--psm", "11", "-l", "eng", "tsv"], capture_output=True, text=True, encoding="utf-8", timeout=180).stdout
            items = []
            for row in tsv.splitlines()[1:]:
                f = row.split("\t")
                if len(f) < 12 or f[0] != "5" or not f[11].strip() or float(f[10]) < 0:
                    continue
                x, y, w, h = int(f[6]), int(f[7]), int(f[8]), int(f[9])
                items.append({"box": [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], "text": f[11].strip(), "conf": float(f[10]) / 100})
            out({"ok": True, "ms": int((time.time() - t) * 1000), "items": items})
        except Exception as e:
            out({"ok": False, "error": f"{type(e).__name__}: {e}"})


if __name__ == "__main__":
    main()
