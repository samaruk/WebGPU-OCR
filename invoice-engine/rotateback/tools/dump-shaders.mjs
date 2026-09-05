/**
 * Write every WGSL kernel to build/wgsl/*.wgsl so an external validator (naga,
 * tint, wgsl-analyzer) can compile them. The shaders live in JS template
 * literals with interpolated helper snippets, so they have to be evaluated
 * rather than scraped.
 *
 *   node tools/dump-shaders.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'build', 'wgsl');
fs.mkdirSync(out, { recursive: true });

const modules = {
  preprocess: await import('../src/gridlift/shaders/preprocess.js'),
  morphology: await import('../src/gridlift/shaders/morphology.js'),
  cca: await import('../src/gridlift/shaders/cca.js'),
  projections: await import('../src/gridlift/shaders/projections.js'),
};

let n = 0;
for (const [group, mod] of Object.entries(modules)) {
  for (const [name, code] of Object.entries(mod)) {
    if (typeof code !== 'string' || !code.includes('@compute')) continue;
    fs.writeFileSync(path.join(out, `${group}__${name}.wgsl`), code);
    n++;
  }
}
console.log(`wrote ${n} kernels to ${path.relative(process.cwd(), out)}`);
