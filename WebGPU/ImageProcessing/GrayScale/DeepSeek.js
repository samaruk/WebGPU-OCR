class WebGPUGrayscaleConverter {
    constructor() {
        this.device = null;
        this.context = null;
        this.pipeline = null;
        this.bindGroup = null;
        this.texture = null;
        this.sampler = null;
        this.outputTexture = null;

        this.originalCanvas = document.getElementById('originalCanvas');
        this.grayscaleCanvas = document.getElementById('grayscaleCanvas');
        this.imageInput = document.getElementById('imageInput');
        this.convertBtn = document.getElementById('convertBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.errorDiv = document.getElementById('error');

        this.originalCtx = this.originalCanvas.getContext('2d');
        this.originalImage = null;

        this.init();
    }

    async init() {
        try {
            // Check if WebGPU is supported
            if (!navigator.gpu) {
                throw new Error('WebGPU is not supported in this browser.');
            }

            // Request adapter and device
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) {
                throw new Error('No WebGPU adapter found.');
            }

            this.device = await adapter.requestDevice();

            // Initialize WebGPU context for grayscale canvas
            this.context = this.grayscaleCanvas.getContext('webgpu');
            if (!this.context) {
                throw new Error('WebGPU context not available.');
            }

            const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
            this.context.configure({
                device: this.device,
                format: canvasFormat,
                alphaMode: 'premultiplied'
            });

            this.setupEventListeners();
            this.hideError();
        } catch (error) {
            this.showError(`Initialization failed: ${error.message}`);
            console.error('WebGPU initialization error:', error);
        }
    }

    setupEventListeners() {
        this.imageInput.addEventListener('change', (e) => this.handleImageUpload(e));
        this.convertBtn.addEventListener('click', () => this.convertToGrayscale());
        this.resetBtn.addEventListener('click', () => this.reset());
    }

    handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.displayOriginalImage();
                this.convertBtn.disabled = false;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    displayOriginalImage() {
        const canvas = this.originalCanvas;
        const ctx = this.originalCtx;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Calculate dimensions to maintain aspect ratio
        const img = this.originalImage;
        const scale = Math.min(
            canvas.width / img.width,
            canvas.height / img.height
        );
        const width = img.width * scale;
        const height = img.height * scale;
        const x = (canvas.width - width) / 2;
        const y = (canvas.height - height) / 2;

        // Draw image
        ctx.drawImage(img, x, y, width, height);
    }

    async createTextureFromImage(image) {

        // ---------------- Source texture ----------------
        this.texture = this.device.createTexture({
            size: [image.width, image.height],
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
        });

        device.queue.copyExternalImageToTexture(
            { source: image },
            { texture: this.texture },
            [image.width, image.height]
        );
        

        // Create sampler
        this.sampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear'
        });

        // Create output texture
        this.outputTexture = this.device.createTexture({
            size: [image.width, image.height],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.COPY_SRC |
                GPUTextureUsage.TEXTURE_BINDING
        });
    }

    async createPipeline() {
        // Shader module for grayscale conversion
        const shaderModule = this.device.createShaderModule({
            code: `
                        @group(0) @binding(0) var inputTexture: texture_2d<f32>;
                        @group(0) @binding(1) var inputSampler: sampler;
                        @group(0) @binding(2) var outputTexture: texture_storage_2d<rgba8unorm, write>;

                        @vertex
                        fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4f {
                            const pos = array(
                                vec2f(-1.0, -1.0),
                                vec2f(-1.0, 3.0),
                                vec2f(3.0, -1.0)
                            );
                            return vec4f(pos[vertexIndex], 0.0, 1.0);
                        }

                        @fragment
                        fn fragmentMain(@builtin(position) position : vec4f) -> @location(0) vec4f {
                            let texCoord = position.xy / vec2f(textureDimensions(inputTexture));

                            // Sample the original RGB color
                            let rgbColor = textureSample(inputTexture, inputSampler, texCoord);

                            // Convert to grayscale using luminance formula
                            // Standard luminance formula: 0.299*R + 0.587*G + 0.114*B
                            let gray = dot(rgbColor.rgb, vec3f(0.299, 0.587, 0.114));

                            // Return grayscale value for all RGB channels, alpha unchanged
                            return vec4f(gray, gray, gray, rgbColor.a);
                        }
                    `
        });

        // Create render pipeline
        this.pipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vertexMain'
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fragmentMain',
                targets: [{
                    format: 'rgba8unorm'
                }]
            },
            primitive: {
                topology: 'triangle-list'
            }
        });

        // Create bind group
        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: this.texture.createView()
                },
                {
                    binding: 1,
                    resource: this.sampler
                }
            ]
        });
    }

    async convertToGrayscale() {
        if (!this.originalImage || !this.device) {
            this.showError('Please upload an image first.');
            return;
        }

        try {
            this.convertBtn.disabled = true;
            this.convertBtn.textContent = 'Converting...';

            // Create textures
            await this.createTextureFromImage(this.originalImage);

            // Create pipeline if not exists
            if (!this.pipeline) {
                await this.createPipeline();
            }

            // Create command encoder
            const commandEncoder = this.device.createCommandEncoder();

            // Create render pass
            const renderPass = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: this.outputTexture.createView(),
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: 'clear',
                    storeOp: 'store'
                }]
            });

            // Set pipeline and draw
            renderPass.setPipeline(this.pipeline);
            renderPass.setBindGroup(0, this.bindGroup);
            renderPass.draw(3);
            renderPass.end();

            // Copy output texture to canvas
            const canvasTexture = this.context.getCurrentTexture();
            commandEncoder.copyTextureToTexture(
                {
                    texture: this.outputTexture,
                    mipLevel: 0,
                    origin: { x: 0, y: 0, z: 0 }
                },
                {
                    texture: canvasTexture,
                    mipLevel: 0,
                    origin: { x: 0, y: 0, z: 0 }
                },
                {
                    width: this.originalImage.width,
                    height: this.originalImage.height
                }
            );

            // Submit commands
            this.device.queue.submit([commandEncoder.finish()]);

            this.convertBtn.textContent = 'Convert to Grayscale';
            this.convertBtn.disabled = false;
            this.hideError();

        } catch (error) {
            this.showError(`Conversion failed: ${error.message}`);
            console.error('Conversion error:', error);
            this.convertBtn.textContent = 'Convert to Grayscale';
            this.convertBtn.disabled = false;
        }
    }

    reset() {
        // Clear canvases
        this.originalCtx.clearRect(0, 0, this.originalCanvas.width, this.originalCanvas.height);
        const grayscaleCtx = this.grayscaleCanvas.getContext('2d');
        grayscaleCtx.clearRect(0, 0, this.grayscaleCanvas.width, this.grayscaleCanvas.height);

        // Reset input and button
        this.imageInput.value = '';
        this.convertBtn.disabled = true;
        this.originalImage = null;

        // Clear textures
        this.texture = null;
        this.outputTexture = null;

        this.hideError();
    }

    showError(message) {
        this.errorDiv.textContent = message;
        this.errorDiv.style.display = 'block';
    }

    hideError() {
        this.errorDiv.style.display = 'none';
    }
}

// Initialize the application when the page loads
window.addEventListener('DOMContentLoaded', () => {
    new WebGPUGrayscaleConverter();
});