// shaders/common/atomics.wgsl — Atomic counter helpers

// Atomically append an item to a list.
// Returns the index written, or ~0u if the list is full.
fn atomic_append(counter: ptr<storage,atomic<u32>,read_write>, max_count: u32) -> u32 {
  let idx = atomicAdd(counter, 1u);
  if (idx >= max_count) {
    atomicSub(counter, 1u);   // roll back
    return ~0u;
  }
  return idx;
}
