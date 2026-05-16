
const byChatGPT = `
@group(0) @binding(0)
var inputTex: texture_2d<f32>;

@group(0) @binding(1)
var outputTex: texture_storage_2d<rgba32float, write>;

@group(0) @binding(2)
var<uniform> params: vec2<u32>; // width, height

fn luminance(c: vec3<f32>) -> f32 {
    return dot(c, vec3<f32>(0.299, 0.587, 0.114));
}

fn sampleGray(p: vec2<i32>, dims: vec2<i32>) -> f32 {
    let q = clamp(p, vec2<i32>(0), dims - 1);
    let c = textureLoad(inputTex, q, 0);
    return luminance(c.rgb);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let dimsU = vec2<u32>(params);
    if (gid.x >= dimsU.x || gid.y >= dimsU.y) {
        return;
    }

    let dims = vec2<i32>(dimsU);
    let p = vec2<i32>(gid.xy);

    // Load neighborhood (fully unrolled)
    let g00 = sampleGray(p + vec2<i32>(-1, -1), dims);
    let g10 = sampleGray(p + vec2<i32>( 0, -1), dims);
    let g20 = sampleGray(p + vec2<i32>( 1, -1), dims);

    let g01 = sampleGray(p + vec2<i32>(-1,  0), dims);
    let g21 = sampleGray(p + vec2<i32>( 1,  0), dims);

    let g02 = sampleGray(p + vec2<i32>(-1,  1), dims);
    let g12 = sampleGray(p + vec2<i32>( 0,  1), dims);
    let g22 = sampleGray(p + vec2<i32>( 1,  1), dims);

    // Sobel gradients
    let gx =
        -g00 + g20 +
        -2.0 * g01 + 2.0 * g21 +
        -g02 + g22;

    let gy =
        -g00 - 2.0 * g10 - g20 +
         g02 + 2.0 * g12 + g22;

    // Gradient magnitude
    let mag = sqrt(gx * gx + gy * gy);

    textureStore(
        outputTex,
        p,
        vec4<f32>(mag, mag, mag, 1.0)
    );
}

`;

const shader = `
            @group(0) @binding(0) var inputTex: texture_2d<f32>;
            @group(0) @binding(1) var output: texture_storage_2d<rgba32float, write>;
            @group(0) @binding(2) var<uniform> params: vec2<u32>;

            fn getColor(pos: vec2<i32>) -> vec4<f32> {
                let dims = vec2<i32>(params);
                let clamped = clamp(pos, vec2<i32>(0), dims - 1);
                let color = textureLoad(inputTex, clamped, 0);
                return color;
                //return dot(color.rgb, vec3<f32>(0.299, 0.587, 0.114));
            }

            @compute @workgroup_size(8, 8)
            fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
                let dims = vec2<u32>(params);
                if (gid.x >= dims.x || gid.y >= dims.y) { return; }

                let pos = vec2<i32>(gid.xy);
                let idx = gid.y * dims.x + gid.x;


                // Compute gradients with Sobel

                var blueX = 0.0;
                var greenX = 0.0;
                var redX = 0.0;

                var blueY = 0.0;
                var greenY = 0.0;
                var redY = 0.0;

                var blueTotal = 0.0;
                var greenTotal = 0.0;
                var redTotal = 0.0;

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
                        let color = getColor(p);
                        let sx= sobelX[dy][dx];
                        let sy= sobelY[dy][dx];

                        redX+=color.r*sx;
                        greenX+=color.g*sx;
                        blueX+=color.b*sx;

                        redY+=color.r*sy;
                        greenY+=color.g*sy;
                        blueY+=color.b*sy;
                    }
                }
                // Calculate gradient magnitude

                redTotal = sqrt(redX * redX + redY * redY);
                greenTotal = sqrt(greenX * greenX + greenY * greenY);
                blueTotal = sqrt(blueX * blueX + blueY * blueY);
                textureStore(output, pos, vec4<f32>((redX*0.299+greenX*0.587+blueX*0.114)*0.125, (redY*0.299+greenY*0.587+blueY*0.114)*0.125, (redTotal*0.299+greenTotal*0.587+blueTotal*0.114), 1.0));
            }
        `;
export { shader };

