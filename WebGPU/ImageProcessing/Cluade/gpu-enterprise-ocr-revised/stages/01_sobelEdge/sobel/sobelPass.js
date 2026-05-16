
import { dispatch2D } from '../../../core/dispatchUtils.js';
export function encodeSobelPass(device,encoder,pipeline,inputTex,outputTex,width,height){
  const bg=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
    {binding:0,resource:inputTex.createView()},
    {binding:1,resource:outputTex.createView()},
  ]});
  const p=encoder.beginComputePass({label:'sobelPass'});
  p.setPipeline(pipeline);p.setBindGroup(0,bg);
  p.dispatchWorkgroups(...dispatch2D(width,height));p.end();
}
