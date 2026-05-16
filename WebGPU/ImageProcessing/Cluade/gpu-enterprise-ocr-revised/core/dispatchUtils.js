
export function dispatch2D(w, h, wgW=16, wgH=16) {
  return [Math.ceil(w/wgW), Math.ceil(h/wgH), 1];
}
export function dispatch1D(n, wgSize=256) {
  return [Math.ceil(n/wgSize), 1, 1];
}
