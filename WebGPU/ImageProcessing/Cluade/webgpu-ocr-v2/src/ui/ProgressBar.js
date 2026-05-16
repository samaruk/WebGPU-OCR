// src/ui/ProgressBar.js
export class ProgressBar {
  constructor(el) { this.el = el; }
  set(pct) { this.el.style.width = Math.min(100, Math.round(pct)) + "%"; }
  done()   { this.set(100); }
  reset()  { this.set(0); }
}