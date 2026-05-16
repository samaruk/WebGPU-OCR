@group(0) @binding(0) var inputTex: texture_2d<f32>;
            @group(0) @binding(1) var<storage, read_write> output: array<vec4<f32>>;
            @group(0) @binding(2) var<uniform> params: vec2<u32>;

            fn getGray(pos: vec2<i32>) -> f32 {
                let dims = vec2<i32>(params);
                let clamped = clamp(pos, vec2<i32>(0), dims - 1);
                let color = textureLoad(inputTex, clamped, 0);
                return dot(color.rgb, vec3<f32>(0.299, 0.587, 0.114));
            }

            @compute @workgroup_size(8, 8)
            fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
                let dims = vec2<u32>(params);
                if (gid.x >= dims.x || gid.y >= dims.y) { return; }

                let pos = vec2<i32>(gid.xy);
                let idx = gid.y * dims.x + gid.x;

                // Compute gradients with Sobel
                var Ix = 0.0;
                var Iy = 0.0;

                // Sobel kernel
                let sobelX = array<array<f32, 3>, 3>(
                    array<f32, 3>(-1.0, 0.0, 1.0),
                    array<f32, 3>(-2.0, 0.0, 2.0),
                    array<f32, 3>(-1.0, 0.0, 1.0)
                );

                let sobelY = array<array<f32, 3>, 3>(
                    array<f32, 3>(-1.0, -2.0, -1.0),
                    array<f32, 3>(0.0, 0.0, 0.0),
                    array<f32, 3>(1.0, 2.0, 1.0)
                );

                for (var dy = 0; dy < 3; dy++) {
                    for (var dx = 0; dx < 3; dx++) {
                        let p = pos + vec2<i32>(dx - 1, dy - 1);
                        let gray = getGray(p);
                        Ix += gray * sobelX[dy][dx];
                        Iy += gray * sobelY[dy][dx];
                    }
                }

                // Normalize gradients
                Ix *= 0.125;
                Iy *= 0.125;

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
                        let p = pos + vec2<i32>(dx - 2, dy - 2);

                        // Compute gradients at this position
                        var gx = 0.0;
                        var gy = 0.0;
                        for (var sdy = 0; sdy < 3; sdy++) {
                            for (var sdx = 0; sdx < 3; sdx++) {
                                let sp = p + vec2<i32>(sdx - 1, sdy - 1);
                                let g = getGray(sp);
                                gx += g * sobelX[sdy][sdx];
                                gy += g * sobelY[sdy][sdx];
                            }
                        }
                        gx *= 0.125;
                        gy *= 0.125;

                        let w = gauss[dy][dx];
                        Ixx += w * gx * gx;
                        Iyy += w * gy * gy;
                        Ixy += w * gx * gy;
                    }
                }

                // Harris corner response
                let det = Ixx * Iyy - Ixy * Ixy;
                let trace = Ixx + Iyy;
                let k = 0.04;
                let response = det - k * trace * trace;

                output[idx] = vec4<f32>(response, f32(gid.x), f32(gid.y), 0.0);
            }