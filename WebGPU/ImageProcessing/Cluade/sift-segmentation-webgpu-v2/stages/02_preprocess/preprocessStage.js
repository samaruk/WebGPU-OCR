// preprocessStage.js — orchestrates preprocess passes + visualization
import { makeRgbToGrayPipeline }  from './rgbToGray.js';
import { makeClaheHistPipeline }  from './claheHistogram.js';
import { makeClaheApplyPipeline } from './claheApply.js';
import { makeGammaPipeline }      from './gammaCorrection.js';
import { makeGaussBlurHPipeline } from './gaussianBlurH.js';
import { makeGaussBlurVPipeline } from './gaussianBlurV.js';
import { gaussianKernel1D, ceilDiv } from '../00_common/math.js';
import { blitBufferToCanvas } from '../../core/dispatch.js';
import { Config } from '../../config.js';

export class PreprocessStage {
  #pls={}; #device; #queue;
  constructor(device,queue){ this.#device=device; this.#queue=queue; }

  async init(loadShader){
    const d=this.#device;
    const [g,ch,ca,gm,bH,bV] = await Promise.all([
      makeRgbToGrayPipeline(d,loadShader),
      makeClaheHistPipeline(d,loadShader),
      makeClaheApplyPipeline(d,loadShader),
      makeGammaPipeline(d,loadShader),
      makeGaussBlurHPipeline(d,loadShader),
      makeGaussBlurVPipeline(d,loadShader),
    ]);
    this.#pls={g,ch,ca,gm,bH,bV};
  }

  encode(enc, mem){
    const d=this.#device; const q=this.#queue;
    const W=mem.W; const H=mem.H;
    const U=GPUBufferUsage;

    // Upload Gaussian kernel once
    const kdata=gaussianKernel1D(Config.GAUSS_SIGMA, Config.GAUSS_RADIUS);
    q.writeBuffer(mem.gaussKernel,0,kdata);

    const uni=(data)=>{
      const b=d.createBuffer({size:Math.max(data.byteLength,16),usage:U.UNIFORM|U.COPY_DST});
      q.writeBuffer(b,0,data); return b;
    };
    const wh=uni(new Uint32Array([W,H,W,H]));
    const radUni=uni(new Uint32Array([W,H,Config.GAUSS_RADIUS,0]));

    // Gray copy (src already in grayBuf from upload)
    const p0=enc.beginComputePass({label:'gray_copy'});
    p0.setPipeline(this.#pls.g);
    p0.setBindGroup(0,d.createBindGroup({layout:this.#pls.g.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:wh}},
      {binding:1,resource:{buffer:mem.grayBuf}},
      {binding:2,resource:{buffer:mem.claheBuf}},
    ]}));
    p0.dispatchWorkgroups(ceilDiv(W,8),ceilDiv(H,8)); p0.end();

    // Gamma
    const gammaData=new ArrayBuffer(16); new Float32Array(gammaData)[2]=Config.GAMMA;
    new Uint32Array(gammaData)[0]=W; new Uint32Array(gammaData)[1]=H;
    const gamUni=uni(gammaData);
    const p1=enc.beginComputePass({label:'gamma'});
    p1.setPipeline(this.#pls.gm);
    p1.setBindGroup(0,d.createBindGroup({layout:this.#pls.gm.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:gamUni}},
      {binding:1,resource:{buffer:mem.claheBuf}},
      {binding:2,resource:{buffer:mem.gammaBuf}},
    ]}));
    p1.dispatchWorkgroups(ceilDiv(W,8),ceilDiv(H,8)); p1.end();

    // BlurH
    const p2=enc.beginComputePass({label:'blurH'});
    p2.setPipeline(this.#pls.bH);
    p2.setBindGroup(0,d.createBindGroup({layout:this.#pls.bH.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:radUni}},
      {binding:1,resource:{buffer:mem.gaussKernel}},
      {binding:2,resource:{buffer:mem.gammaBuf}},
      {binding:3,resource:{buffer:mem.blurHBuf}},
    ]}));
    p2.dispatchWorkgroups(ceilDiv(W,8),ceilDiv(H,8)); p2.end();

    // BlurV → final blurBuf
    const p3=enc.beginComputePass({label:'blurV'});
    p3.setPipeline(this.#pls.bV);
    p3.setBindGroup(0,d.createBindGroup({layout:this.#pls.bV.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:radUni}},
      {binding:1,resource:{buffer:mem.gaussKernel}},
      {binding:2,resource:{buffer:mem.blurHBuf}},
      {binding:3,resource:{buffer:mem.blurBuf}},
    ]}));
    p3.dispatchWorkgroups(ceilDiv(W,8),ceilDiv(H,8)); p3.end();
  }

  visualize(mem, canvas){
    blitBufferToCanvas(this.#device, this.#queue, mem.blurBuf, mem.W, mem.H, canvas);
  }
}
