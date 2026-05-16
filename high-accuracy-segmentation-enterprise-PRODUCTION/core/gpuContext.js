
export async function initializeGPU() {
    if (!navigator.gpu) {
        throw new Error("WebGPU not supported in this browser.");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error("Failed to get GPU adapter.");
    }

    const device = await adapter.requestDevice();
    return { adapter, device };
}
