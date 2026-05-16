// core/memoryLayout.js — central GPU buffer/texture registry
import { Config } from '../config.js';
const U = GPUBufferUsage;
const T = GPUTextureUsage;

export class MemoryLayout {
  constructor(device, W, H) {
    this.d=device; this.W=W; this.H=H;
    const N=W*H, NL=Config.MAX_LABELS, ME=Config.MAX_EDGES, MK=Config.MAX_KP;

    const buf=(l,sz,u)=>device.createBuffer({label:l,size:Math.max(sz,16),usage:u});
    const SRW = U.STORAGE|U.COPY_SRC|U.COPY_DST;

    // ── Upload
    this.srcTex   = device.createTexture({label:'srcTex',  size:[W,H],format:'rgba8unorm',  usage:T.TEXTURE_BINDING|T.COPY_DST|T.RENDER_ATTACHMENT});
    this.grayTex  = device.createTexture({label:'grayTex', size:[W,H],format:'r32float',    usage:T.STORAGE_BINDING|T.TEXTURE_BINDING|T.COPY_SRC});

    // ── Preprocess  
    this.grayBuf   = buf('gray',   N*4, SRW);
    this.claheBuf  = buf('clahe',  N*4, SRW);
    this.gammaBuf  = buf('gamma',  N*4, SRW);
    this.blurHBuf  = buf('blurH',  N*4, SRW);
    this.blurBuf   = buf('blur',   N*4, SRW);   // final preprocessed gray

    // ── Pyramid — octave×scale arrays
    const oct=Config.OCTAVES, scl=Config.SCALES+3;
    this.pyrLevels=[];
    this.dogLevels=[];
    for(let o=0;o<oct;o++){
      const ow=W>>o, oh=H>>o, bytes=Math.max(ow*oh*4,16);
      this.pyrLevels[o]=[];
      this.dogLevels[o]=[];
      for(let s=0;s<scl;s++) this.pyrLevels[o][s]=buf(`pyr_${o}_${s}`,bytes,SRW);
      for(let s=0;s<scl-1;s++) this.dogLevels[o][s]=buf(`dog_${o}_${s}`,bytes,SRW);
    }
    this.gaussKernel=buf('kernel',  (Config.GAUSS_RADIUS*2+1)*4, U.STORAGE|U.COPY_DST);

    // ── SIFT
    this.kpPackedBuf = buf('kpPacked', MK*4,    SRW);
    this.kpRefinedBuf= buf('kpRef',    MK*16,   SRW);
    this.kpFinalBuf  = buf('kpFinal',  MK*32,   SRW);
    this.descBuf     = buf('descs',    MK*128*4, SRW);
    this.kpCtr       = buf('kpCtr',    4,        SRW);
    this.magBuf      = buf('mag',      N*4,      SRW);
    this.oriBuf      = buf('ori',      N*4,      SRW);

    // ── Clustering
    this.densityBuf  = buf('density',  N*4,  SRW);
    this.kpLabelBuf  = buf('kpLabel',  MK*4, SRW);
    this.edgeBuf     = buf('edges',    ME*8, SRW);
    this.edgeCtr     = buf('edgeCtr',  4,    SRW);

    // ── Stroke
    this.gradMagBuf  = buf('gradMag',  N*4,  SRW);
    this.gradAngBuf  = buf('gradAng',  N*4,  SRW);
    this.swtBuf      = buf('swt',      N*4,  SRW);
    this.consistBuf  = buf('consist',  N*4,  SRW);

    // ── Fusion
    this.maskBuf     = buf('mask',     N*4,  SRW);
    this.confBuf     = buf('conf',     N*4,  SRW);
    this.binaryBuf   = buf('binary',   N*4,  SRW);

    // ── Segmentation
    this.labelBuf    = buf('labels',   N*4,  SRW);
    this.label2Buf   = buf('labels2',  N*4,  SRW);
    this.relabelBuf  = buf('relabels', N*4,  SRW);
    this.remapBuf    = buf('remap',    NL*4, SRW);
    this.segCtr      = buf('segCtr',   4,    SRW);
    this.changedBuf  = buf('changed',  4,    SRW);

    // ── Skeleton
    this.skelBuf     = buf('skel',     N*4,  SRW);
    this.markBuf     = buf('mark',     N*4,  SRW);
    this.endpBuf     = buf('endp',     N*4,  SRW);
    this.branchBuf   = buf('branch',   N*4,  SRW);

    // ── Graph
    this.graphEdgeBuf   = buf('gEdges',   ME*8,  SRW);
    this.graphEdgeCtr   = buf('gEdgeCtr', 4,     SRW);
    this.mergeScoreBuf  = buf('mScore',   ME*4,  SRW);
    this.splitScoreBuf  = buf('sScore',   NL*4,  SRW);
    this.labelMapBuf    = buf('lmap',     NL*4,  SRW);

    // ── Postprocess
    this.bboxBuf     = buf('bbox',     NL*32, SRW);
    this.keepBuf     = buf('keep',     NL*4,  SRW);
    this.polyBuf     = buf('poly',     NL*32, SRW);
    this.outTex      = device.createTexture({label:'outTex',size:[W,H],format:'rgba8unorm',
                         usage:T.STORAGE_BINDING|T.TEXTURE_BINDING|T.COPY_SRC});
  }

  destroy(){
    const all=[
      this.srcTex,this.grayTex,this.outTex,
      this.grayBuf,this.claheBuf,this.gammaBuf,this.blurHBuf,this.blurBuf,
      this.gaussKernel,this.kpPackedBuf,this.kpRefinedBuf,this.kpFinalBuf,
      this.descBuf,this.kpCtr,this.magBuf,this.oriBuf,
      this.densityBuf,this.kpLabelBuf,this.edgeBuf,this.edgeCtr,
      this.gradMagBuf,this.gradAngBuf,this.swtBuf,this.consistBuf,
      this.maskBuf,this.confBuf,this.binaryBuf,
      this.labelBuf,this.label2Buf,this.relabelBuf,this.remapBuf,this.segCtr,this.changedBuf,
      this.skelBuf,this.markBuf,this.endpBuf,this.branchBuf,
      this.graphEdgeBuf,this.graphEdgeCtr,this.mergeScoreBuf,this.splitScoreBuf,this.labelMapBuf,
      this.bboxBuf,this.keepBuf,this.polyBuf,
    ];
    all.forEach(r=>r?.destroy());
    this.pyrLevels.forEach(o=>o.forEach(b=>b.destroy()));
    this.dogLevels.forEach(o=>o.forEach(b=>b.destroy()));
  }
}
