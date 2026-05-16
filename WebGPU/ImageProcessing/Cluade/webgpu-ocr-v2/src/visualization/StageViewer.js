export class StageViewer {
  update(canvas, label) {
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    ctx2d.fillStyle = "rgba(0,212,255,0.9)";
    ctx2d.fillRect(4, 4, label.length*7+8, 20);
    ctx2d.fillStyle = "#000";
    ctx2d.font = "bold 10px monospace";
    ctx2d.fillText(label, 8, 17);
  }
}