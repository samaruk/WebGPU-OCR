// Typed event bus for progressive stage result streaming
export class EventBus {
  constructor() { this._listeners = new Map(); }

  on(event, cb) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(cb);
    return () => this.off(event, cb);
  }

  off(event, cb) {
    const arr = this._listeners.get(event);
    if (arr) this._listeners.set(event, arr.filter(f => f !== cb));
  }

  emit(event, ...args) {
    (this._listeners.get(event) ?? []).forEach(cb => {
      try { cb(...args); } catch(e) { console.error("[EventBus]", event, e); }
    });
  }

  once(event, cb) {
    const unsub = this.on(event, (...args) => { cb(...args); unsub(); });
  }
}

// Standard pipeline events
export const EVENTS = {
  STAGE_START:    "stage:start",
  STAGE_DONE:     "stage:done",
  STAGE_ERROR:    "stage:error",
  PIPELINE_START: "pipeline:start",
  PIPELINE_DONE:  "pipeline:done",
  PIPELINE_ERROR: "pipeline:error",
  LOG:            "log",
};