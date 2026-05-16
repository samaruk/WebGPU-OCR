export async function initGPU(canvas) {
    if (!navigator.gpu) throw new Error("WebGPU not supported");

    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();

    const context = canvas.getContext("webgpu");
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device,
        format,
        alphaMode: "premultiplied"
    });

    return { device, context, format };
}
