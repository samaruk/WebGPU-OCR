const shader = `
            @group(0) @binding(0) var inputTex: texture_2d<f32>;
            @group(0) @binding(1) var<storage, read_write> output: array<vec4<f32>>;
            @group(0) @binding(2) var<uniform> params: vec2<u32>;

            fn getSobel(pos: vec2<i32>) -> vec4<f32> {
                let dims = vec2<i32>(params);
                let clamped = clamp(pos, vec2<i32>(0), dims - 1);
                let color = textureLoad(inputTex, clamped, 0);
                return color;
            }


            @compute @workgroup_size(8, 8)
            fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
                let dims = vec2<u32>(params);
                if (gid.x >= dims.x || gid.y >= dims.y) { return; }

                let pos = vec2<i32>(gid.xy);
                let idx = gid.y * dims.x + gid.x;

                // Structure tensor with Gaussian smoothing
                var Ixx = 0.0;
                var Iyy = 0.0;
                var Ixy = 0.0;

                // Gaussian kernel 5x5 (sigma=1.0)
                let gauss = array<array<f32, 5>, 5>(
                    array<f32, 5>(0.003765, 0.015019, 0.023792, 0.015019, 0.003765),
                    array<f32, 5>(0.015019, 0.059912, 0.094907, 0.059912, 0.015019),
                    array<f32, 5>(0.023792, 0.094907, 0.150342, 0.094907, 0.023792),
                    array<f32, 5>(0.015019, 0.059912, 0.094907, 0.059912, 0.015019),
                    array<f32, 5>(0.003765, 0.015019, 0.023792, 0.015019, 0.003765)
                );

                for (var dy = 0; dy < 5; dy++) {
                    for (var dx = 0; dx < 5; dx++) {
                        let p = pos + vec2<i32>(dx, dy);

                        let sobel = getSobel(p);
                        
                        let w = gauss[dy][dx];
                        Ixx += w * sobel.r * sobel.r;
                        Iyy += w * sobel.g * sobel.g;
                        Ixy += w * sobel.r * sobel.g;
                    }
                }

                // Harris corner response
                let det = Ixx * Iyy - Ixy * Ixy;
                let trace = Ixx + Iyy;
                let k = 0.04;
                let response = det - k * trace * trace;
                let sobel = getSobel(pos);
                output[idx] = vec4<f32>(response, f32(gid.x), f32(gid.y), sobel.b);
            }
        `;
export { shader };