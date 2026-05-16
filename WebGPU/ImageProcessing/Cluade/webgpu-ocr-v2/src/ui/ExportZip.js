// src/ui/ExportZip.js – collects all stage canvases → ZIP download
export class ExportZip {
  constructor(canvasMap, btn) {
    this.canvasMap = canvasMap;
    btn.addEventListener("click", () => this.download());
  }

  async download() {
    const JSZip = (await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm")).default;
    const zip   = new JSZip();
    const imgs  = zip.folder("stages");

    const promises = Object.entries(this.canvasMap).map(([id, canvas]) => {
      return new Promise(resolve => {
        canvas.toBlob(blob => {
          if (blob) imgs.file(`${id}.png`, blob);
          resolve();
        }, "image/png");
      });
    });
    await Promise.all(promises);

    // Add JSON result if available
    const doc = window.__ocrDocument;
    if (doc) zip.file("result.json", JSON.stringify(doc, null, 2));
    zip.file("fulltext.txt", doc?.fullText ?? "");

    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `webgpu-ocr-${Date.now()}.zip`;
    a.click(); URL.revokeObjectURL(url);
  }
}