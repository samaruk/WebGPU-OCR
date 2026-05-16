// Wraps onnxruntime-web with EP selection + session management
export class ONNXRuntime {
  static async createSession(modelPath, preferredEPs = ["webgpu","wasm"]) {
    const ort = await import("onnxruntime-web");
    for (const ep of preferredEPs) {
      try {
        const session = await ort.InferenceSession.create(modelPath, {
          executionProviders: [ep],
          graphOptimizationLevel: "all",
        });
        return session;
      } catch { /* try next EP */ }
    }
    throw new Error(`Could not create ONNX session for ${modelPath}`);
  }
}