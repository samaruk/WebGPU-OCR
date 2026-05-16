// core/bindGroupLayouts.js
const C = GPUShaderStage.COMPUTE;
export const uniformEntry        = (b,vis=C) => ({binding:b,visibility:vis,buffer:{type:'uniform'}});
export const storageEntry        = (b,ro=false,vis=C) => ({binding:b,visibility:vis,buffer:{type:ro?'read-only-storage':'storage'}});
export const sampledTextureEntry = (b,vis=C,st='float') => ({binding:b,visibility:vis,texture:{sampleType:st,viewDimension:'2d'}});
export const storageTextureEntry = (b,fmt,acc='write-only',vis=C) => ({binding:b,visibility:vis,storageTexture:{access:acc,format:fmt,viewDimension:'2d'}});
export const samplerEntry        = (b,vis=C,type='filtering') => ({binding:b,visibility:vis,sampler:{type}});
export const makeLayout          = (device,label,entries) => device.createBindGroupLayout({label,entries});
