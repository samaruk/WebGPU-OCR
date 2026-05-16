

const shader = `
            @group(0) @binding(0) var<storage, read> input: array<vec4<f32>>;
            @group(0) @binding(1) var<storage, read_write> output: array<vec4<f32>>;
            @group(0) @binding(2) var<uniform> params: vec4<f32>; // width, height, threshold, radius

            @compute @workgroup_size(8, 8)
            fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
                let width = u32(params.x);
                let height = u32(params.y);
                let threshold = params.z;
                let radius = i32(params.w);

                if (gid.x >= width || gid.y >= height) { return; }

                let idx = gid.y * width + gid.x;
                let response = input[idx].x;
                let sobel = input[idx].w;

                // Check threshold
                if (response < threshold) {
                    output[idx] = vec4<f32>(0.0,0.0,response,sobel);
                    return;
                }

                // Non-maximum suppression in local window
                var isMax = true;
                for (var dy = -radius; dy <= radius; dy++) {
                    for (var dx = -radius; dx <= radius; dx++) {
                        if (dx == 0 && dy == 0) { continue; }

                        let nx = i32(gid.x) + dx;
                        let ny = i32(gid.y) + dy;

                        if (nx >= 0 && nx < i32(width) && ny >= 0 && ny < i32(height)) {
                            let nidx = u32(ny) * width + u32(nx);
                            if (input[nidx].x > response) {
                                isMax = false;
                                break;
                            }
                        }
                    }
                    if (!isMax) { break; }
                }

                if (isMax) {
                    output[idx] = input[idx];
                } else {
                    output[idx] = vec4<f32>(0.0,0.0,response,sobel);
                }
            }
        `;
export { shader };