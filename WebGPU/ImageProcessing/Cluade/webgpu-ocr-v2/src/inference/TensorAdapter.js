// Convert between ONNX Tensors and plain Float32Arrays
export class TensorAdapter {
  static async toONNX(data, shape) {
    const ort = await import("onnxruntime-web");
    return new ort.Tensor("float32", data instanceof Float32Array ? data : new Float32Array(data), shape);
  }
  static fromONNX(tensor) {
    return { data: tensor.data, shape: tensor.dims };
  }
}