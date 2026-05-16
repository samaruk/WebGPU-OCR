// math.wgsl — common math helpers
const PI      : f32 = 3.14159265358979;
const TWO_PI  : f32 = 6.28318530717959;
const SQRT2   : f32 = 1.41421356237310;

fn gaussian1d(x:f32, sigma:f32)->f32{ return exp(-x*x/(2.0*sigma*sigma)); }
fn gaussian2d(x:f32,y:f32,sigma:f32)->f32{ return exp(-(x*x+y*y)/(2.0*sigma*sigma)); }
fn safe_div(a:f32,b:f32)->f32{ return select(0.0,a/b,abs(b)>1e-10); }
fn clamp01(v:f32)->f32{ return clamp(v,0.0,1.0); }
fn fast_atan2(y:f32,x:f32)->f32{
  let ay=abs(y); let ax=abs(x);
  let z=select(ay/ax,ax/ay,ax>=ay);
  var a=z*(PI/4.0-(z-1.0)*(0.2447+0.0663*z));
  a=select(PI/2.0-a,a,ax>=ay);
  a=select(PI-a,a,x<0.0);
  return select(-a,a,y>=0.0);
}
fn norm_angle(a:f32)->f32{
  var v=a%TWO_PI; if(v<0.0){v+=TWO_PI;} return v;
}
