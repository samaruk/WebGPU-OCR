// core/dispatchGraph.js
export class DispatchGraph {
  #passes=[];
  add(name,fn,reads=[],writes=[]){ this.#passes.push({name,fn,reads,writes}); return this; }
  execute(encoder){ for(const p of this.#passes) p.fn(encoder); }
  report(){ return this.#passes.map(p=>`${p.name} R[${p.reads}] W[${p.writes}]`).join('\n'); }
  reset(){ this.#passes=[]; }
}
