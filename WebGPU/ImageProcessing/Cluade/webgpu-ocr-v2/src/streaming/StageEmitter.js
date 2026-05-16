// Emits stage-done events progressively
export class StageEmitter {
  constructor(bus) { this.bus = bus; }
  emit(id, result) { this.bus.emit("stage:result", { id, result }); }
}