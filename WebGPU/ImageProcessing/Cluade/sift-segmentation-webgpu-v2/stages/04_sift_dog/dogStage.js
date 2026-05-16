// dogStage.js — compute all DoG layers across all octaves
import { makeDogPipeline } from './dog.js';
import { ceilDiv }         from '../00_common/math.js';
import { blitBufferToCanvas } from '../../core/dispatch.js';
import { Config } from '../../config.js';

export class DogStage {
  #pl; #device; #queue;
  constructor(device,queue){ this.#device=device; this.#queue=queue; }

  async init(loadShader){ this.#pl=await makeDogPipeline(this.#device,loadShader); }

  encode(enc, mem){
    const d=this.#device; const q=this.#queue; const U=GPUBufferUsage;
    const scl=Config.SCALES+2;
    for(let o=0;o<Config.OCTAVES;o++){
      const ow=mem.W>>o; const oh=mem.H>>o;
      const uni=d.createBuffer({size:16,usage:U.UNIFORM|U.COPY_DST});
      q.writeBuffer(uni,0,new Uint32Array([ow,oh,0,0]));
      for(let s=0;s<scl;s++){
        const bg=d.createBindGroup({layout:this.#pl.getBindGroupLayout(0),entries:[
          {binding:0,resource:{buffer:uni}},
          {binding:1,resource:{buffer:mem.pyrLevels[o][s+1]}},
          {binding:2,resource:{buffer:mem.pyrLevels[o][s]}},
          {binding:3,resource:{buffer:mem.dogLevels[o][s]}},
        ]});
        const p=enc.beginComputePass({label:`dog_${o}_${s}`});
        p.setPipeline(this.#pl); p.setBindGroup(0,bg);
        p.dispatchWorkgroups(ceilDiv(ow,8),ceilDiv(oh,8)); p.end();
      }
    }
  }

  visualize(mem, canvas, octave=0, layer=2){
    // Shift and abs for visibility
    const ow=mem.W>>octave; const oh=mem.H>>octave;
    const d=this.#device; const q=this.#queue;
    const stage=d.createBuffer({size:ow*oh*4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const enc=d.createCommandEncoder();
    enc.copyBufferToBuffer(mem.dogLevels[octave][layer],0,stage,0,ow*oh*4);
    q.submit([enc.finish()]);
    canvas.width=ow; canvas.height=oh;
    stage.mapAsync(GPUMapMode.READ).then(()=>{
      const f=new Float32Array(stage.getMappedRange());
      const rgba=new Uint8ClampedArray(ow*oh*4);
      for(let i=0;i<ow*oh;i++){
        const v=Math.min(1,Math.max(0,(f[i]+0.1)*5));
        rgba[i*4  ]=v>0.5?(v-0.5)*510:0;
        rgba[i*4+1]=v<0.5?v*510:510-v*510;
        rgba[i*4+2]=0; rgba[i*4+3]=255;
      }
      stage.unmap(); stage.destroy();
      canvas.getContext('2d').putImageData(new ImageData(rgba,ow,oh),0,0);
    });
  }
}
