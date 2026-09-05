#!/usr/bin/env python3
"""
Compile every GRIDLIFT kernel with naga (via wgpu-py) so WGSL errors surface in
CI rather than in the browser console.

    pip install wgpu
    node tools/dump-shaders.mjs        # writes .wgsl files to build/wgsl
    python3 tools/validate-shaders.py

Exit code 0 = all kernels compile, 1 = at least one failed, 3 = no adapter
(treat as "skipped", not "passed").
"""

import glob
import os
import sys

os.environ.setdefault("WGPU_FORCE_OFFSCREEN", "1")

try:
    import wgpu
    import wgpu.utils
except ImportError:
    print("wgpu not installed: pip install wgpu")
    sys.exit(3)

OUT = os.path.join(os.path.dirname(__file__), "..", "build", "wgsl")

try:
    device = wgpu.utils.get_default_device()
except Exception as exc:  # noqa: BLE001
    print(f"NO_ADAPTER: {exc}")
    sys.exit(3)

paths = sorted(glob.glob(os.path.join(OUT, "*.wgsl")))
if not paths:
    print(f"no shaders in {OUT} - run: node tools/dump-shaders.mjs")
    sys.exit(1)

failures = 0
for path in paths:
    name = os.path.basename(path)
    with open(path, encoding="utf-8") as fh:
        src = fh.read()
    try:
        device.create_shader_module(code=src)
        print(f"OK    {name}")
    except Exception as exc:  # noqa: BLE001
        failures += 1
        detail = str(exc)[:3000].replace("\n", "\n      ")
        print(f"FAIL  {name}\n      {detail}")

print(f"\n{len(paths) - failures} compiled, {failures} failed")
sys.exit(1 if failures else 0)
