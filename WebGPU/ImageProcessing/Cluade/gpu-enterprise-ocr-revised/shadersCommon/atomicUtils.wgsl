
fn atomicMinF32(ptr:ptr<storage,atomic<u32>,read_write>,val:f32){
  var old=atomicLoad(ptr);
  loop{
    if(bitcast<f32>(old)<=val){break;}
    let p=atomicCompareExchangeWeak(ptr,old,bitcast<u32>(val));
    if(p.exchanged){break;}
    old=p.old_value;
  }
}
