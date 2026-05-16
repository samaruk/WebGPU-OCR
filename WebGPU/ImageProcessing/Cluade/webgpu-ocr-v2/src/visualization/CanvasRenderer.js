export class CanvasRenderer {
  renderF32(canvas, data, W, H) {
    canvas.width = W; canvas.height = H;
    const ctx2d = canvas.getContext("2d");
    const img = ctx2d.createImageData(W, H);
    let min=Infinity, max=-Infinity;
    for (let i=0;i<data.length;i++){if(data[i]<min)min=data[i];if(data[i]>max)max=data[i];}
    const r = Math.max(1e-7, max-min);
    for (let i=0;i<W*H;i++){
      const v=Math.round((data[i]-min)/r*255);
      img.data[i*4]=v;img.data[i*4+1]=v;img.data[i*4+2]=v;img.data[i*4+3]=255;
    }
    ctx2d.putImageData(img, 0, 0);
  }
}