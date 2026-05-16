export class OverlayDrawer {
  boxes(canvas, boxes, color="#00e676", lw=1.5) {
    const ctx2d=canvas.getContext("2d");
    ctx2d.strokeStyle=color;ctx2d.lineWidth=lw;
    for(const b of boxes)ctx2d.strokeRect(b.x,b.y,b.w,b.h);
  }
  keypoints(canvas, kps, color="#5b6af7", r=3) {
    const ctx2d=canvas.getContext("2d");ctx2d.fillStyle=color;
    for(const k of kps){ctx2d.beginPath();ctx2d.arc(k.x,k.y,r,0,Math.PI*2);ctx2d.fill();}
  }
}