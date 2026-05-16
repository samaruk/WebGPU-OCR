import { ocr } from "/Content/WebGPU/ImageProcessing/Cluade/WebGPUOCRPipelineFileStructure/main.js";
let device, img;
const state = {
    maxFeatures: 30000,
    threshold: 0.000001,
    levels: 4
};

function log(msg) {
    const debug = document.getElementById('debug');
    debug.style.display = 'block';
    debug.innerHTML += msg + '<br>';
    debug.scrollTop = debug.scrollHeight;
    console.log(msg);
}

async function processImage() {
    if (!img) return;


    try {
        ocr(img);
    } catch (e) {
    }
}

// Event listeners
document.getElementById('imageInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    img = new Image();
    img.onload = () => {
        const input = document.getElementById('inputCanvas');
        const ctx = input.getContext('2d');
        input.width = img.width;
        input.height = img.height;
        ctx.drawImage(img, 0, 0);
        document.getElementById('processBtn').disabled = false;
        log('Image loaded: ' + img.width + 'x' + img.height);

    };
    img.src = URL.createObjectURL(file);
});


document.getElementById('processBtn').addEventListener('click', processImage);
