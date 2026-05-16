export function selectTopK(device, sortedBuffer, K) {
    const topKBuffer = device.createBuffer({
        size: K * 32,
        usage: GPUBufferUsage.STORAGE
    });
    return topKBuffer;
}
