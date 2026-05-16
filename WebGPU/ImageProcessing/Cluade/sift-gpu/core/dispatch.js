// ============================================================
// SIFT-GPU  –  Dispatch Helpers
// ============================================================
import { CONFIG } from '../config.js';

const WX = CONFIG.workgroupX;
const WY = CONFIG.workgroupY;

/**
 * Calculate the number of workgroups needed to cover a 2D texture.
 */
export function workgroupCount2D(width, height, wx = WX, wy = WY) {
  return {
    x: Math.ceil(width  / wx),
    y: Math.ceil(height / wy),
    z: 1,
  };
}

/**
 * Dispatch a 2D compute pass (shorthand for common SIFT stages).
 *
 * @param {GPUComputePassEncoder} pass
 * @param {GPUComputePipeline}    pipeline
 * @param {GPUBindGroup[]}        bindGroups
 * @param {number}                width
 * @param {number}                height
 */
export function dispatch2D(pass, pipeline, bindGroups, width, height) {
  pass.setPipeline(pipeline);
  bindGroups.forEach((bg, i) => pass.setBindGroup(i, bg));
  const { x, y, z } = workgroupCount2D(width, height);
  pass.dispatchWorkgroups(x, y, z);
}

/**
 * Dispatch a 1D compute pass (e.g. per-keypoint operations).
 */
export function dispatch1D(pass, pipeline, bindGroups, count, workgroupSize = 64) {
  pass.setPipeline(pipeline);
  bindGroups.forEach((bg, i) => pass.setBindGroup(i, bg));
  pass.dispatchWorkgroups(Math.ceil(count / workgroupSize));
}

/**
 * Begin a labelled compute pass, run callback, end it, and submit.
 */
export function runComputePass(device, label, callback) {
  const enc  = device.createCommandEncoder({ label });
  const pass = enc.beginComputePass({ label });
  callback(pass, enc);
  pass.end();
  device.queue.submit([enc.finish()]);
}
