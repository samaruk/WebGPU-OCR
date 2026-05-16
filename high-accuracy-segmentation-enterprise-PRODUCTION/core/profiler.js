
export class Profiler {
    constructor() { this.times = {}; }
    start(name) { this.times[name] = performance.now(); }
    end(name) { this.times[name] = performance.now() - this.times[name]; }
    report() { console.table(this.times); }
}
