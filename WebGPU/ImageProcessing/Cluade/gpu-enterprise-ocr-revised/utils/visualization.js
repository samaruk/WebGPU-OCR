
const BLIT_SHADER = `
struct VSOut { @builtin(position) pos:vec4<f32>, @location(0) uv:vec2<f32> };
@vertex fn vs_main(@builtin(vertex_index) vi:u32)->VSOut{
  var p=array<vec2<f32>,3>(vec2<f32>(-1.,-1.),vec2<f32>(3.,-1.),vec2<f32>(-1.,3.));
  var u=array<vec2<f32>,3>(vec2<f32>(0.,1.),vec2<f32>(2.,1.),vec2<f32>(0.,-1.));
  var o:VSOut; o.pos=vec4<f32>(p[vi],0.,1.); o.uv=u[vi]; return o;
}
@group(0) @binding(0) var tex:texture_2d<f32>;
@group(0) @binding(1) var samp:sampler;
@fragment fn fs_main(v:VSOut)->@location(0) vec4<f32>{return textureSample(tex,samp,v.uv);}
`;

export class Visualizer {
  constructor(device) {
    this.device   = device;
    this._pip     = null;
    this._sampler = device.createSampler({ magFilter:'linear', minFilter:'linear' });
  }
  _pipeline(format) {
    if (this._pip) return this._pip;
    const mod = this.device.createShaderModule({ code:BLIT_SHADER });
    this._pip = this.device.createRenderPipeline({
      layout:'auto',
      vertex:{module:mod,entryPoint:'vs_main'},
      fragment:{module:mod,entryPoint:'fs_main',targets:[{format}]},
      primitive:{topology:'triangle-list'},
    });
    return this._pip;
  }
  blitToCanvas(texture, canvas) {
    const ctx = canvas.getContext('webgpu');
    const fmt = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device:this.device, format:fmt, alphaMode:'opaque' });
    const pip = this._pipeline(fmt);
    const bg  = this.device.createBindGroup({
      layout:pip.getBindGroupLayout(0),
      entries:[
        {binding:0,resource:texture.createView()},
        {binding:1,resource:this._sampler},
      ],
    });
    const enc  = this.device.createCommandEncoder();
    const pass = enc.beginRenderPass({colorAttachments:[{
      view:ctx.getCurrentTexture().createView(),
      loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1},
    }]});
    pass.setPipeline(pip); pass.setBindGroup(0,bg); pass.draw(3); pass.end();
    this.device.queue.submit([enc.finish()]);
  }
  async labelsToRGBA(labelsBuffer, width, height, maxLabel) {
    const { readbackBuffer } = await import('./debugReadback.js');
    const labels = await readbackBuffer(this.device, labelsBuffer, width*height);
    const pixels = new Uint8ClampedArray(width*height*4);
    for (let i=0;i<width*height;i++) {
      const l = labels[i];
      if (!l) { pixels[i*4+3]=255; continue; }
      const h=(l*137.508)%360;
      const [r,g,b]=hsl(h/360,.7,.55);
      pixels[i*4]=r; pixels[i*4+1]=g; pixels[i*4+2]=b; pixels[i*4+3]=255;
    }
    const tex = this.device.createTexture({
      size:[width,height],format:'rgba8unorm',
      usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC,
    });
    this.device.queue.writeTexture({texture:tex},pixels,{bytesPerRow:width*4},[width,height]);
    return tex;
  }
}

function hsl(h,s,l){
  if(!s){const v=Math.round(l*255);return[v,v,v];}
  const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;
  return [hue(p,q,h+1/3),hue(p,q,h),hue(p,q,h-1/3)].map(v=>Math.round(v*255));
}
function hue(p,q,t){
  if(t<0)t+=1;if(t>1)t-=1;
  if(t<1/6)return p+(q-p)*6*t;
  if(t<1/2)return q;
  if(t<2/3)return p+(q-p)*(2/3-t)*6;
  return p;
}
