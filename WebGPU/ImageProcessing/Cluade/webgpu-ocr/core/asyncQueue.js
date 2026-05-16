// Serial async task queue — ensures GPU ops don't overlap unexpectedly

export class AsyncQueue {
  constructor() {
    this._q = Promise.resolve();
  }

  /** Enqueue an async task, returns a promise for its result */
  enqueue(fn) {
    const p = this._q.then(fn);
    this._q = p.catch(() => {});
    return p;
  }

  /** Wait for all queued tasks */
  flush() { return this._q; }
}

export const globalQueue = new AsyncQueue();
