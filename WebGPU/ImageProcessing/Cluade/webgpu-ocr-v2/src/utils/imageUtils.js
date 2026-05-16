export async function fileToImageBitmap(file) {
  return createImageBitmap(file, { colorSpaceConversion:"none" });
}

export function imageDataToFloat32NCHW(imageData) {
  const {data, width:W, height:H} = imageData;
  const N=W*H; const out=new Float32Array(3*N);
  for(let i=0;i<N;i++){out[i]=data[i*4]/255;out[N+i]=data[i*4+1]/255;out[2*N+i]=data[i*4+2]/255;}
  return out;
}

export function clampedU8ToFloat32(data) {
  const out=new Float32Array(data.length);
  for(let i=0;i<data.length;i++) out[i]=data[i];
  return out;
}