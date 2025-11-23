// Import WebGPU bundle for GPU acceleration
import * as ort from 'onnxruntime-web/webgpu';

// Configure ONNX Runtime
ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;

export class Waifu2xUpscaler {
  private session: ort.InferenceSession | null = null;
  private modelPath: string;
  private tileSize: number = 128; // Process in 128x128 tiles
  private tilePad: number = 8;    // Padding to avoid seams
  private fixedInputSize: number = 136; // Fixed input size for WebGL (128 + 8)

  // Use FP16 model for WebGPU (50% less memory)
  constructor(modelPath: string = '/models/waifu2x_anime_6b_fp16.onnx') {
    this.modelPath = modelPath;
  }

  async initialize(): Promise<void> {
    if (this.session) return;

    console.log('Loading ONNX model...');

    // Use WebGPU for GPU acceleration
    const options: ort.InferenceSession.SessionOptions = {
      executionProviders: ['webgpu'],
      graphOptimizationLevel: 'all',
    };

    this.session = await ort.InferenceSession.create(this.modelPath, options);
    console.log('Model loaded with WebGPU (GPU)');
  }

  async upscale(
    imageData: ImageData,
    onProgress?: (progress: number) => void
  ): Promise<ImageData> {
    if (!this.session) {
      throw new Error('Model not initialized. Call initialize() first.');
    }

    const { width, height } = imageData;
    const scale = 4;

    // For small images, process directly
    if (width <= this.tileSize && height <= this.tileSize) {
      return this.upscaleDirect(imageData, onProgress);
    }

    // For larger images, use tiling
    return this.upscaleWithTiling(imageData, onProgress);
  }

  private async upscaleDirect(
    imageData: ImageData,
    onProgress?: (progress: number) => void
  ): Promise<ImageData> {
    const { width, height, data } = imageData;

    onProgress?.(10);

    const inputTensor = this.imageDataToTensor(data, width, height);

    onProgress?.(30);

    const feeds = { input: inputTensor };
    const results = await this.session!.run(feeds);

    onProgress?.(80);

    const outputTensor = results.output;
    const outputData = outputTensor.data as Float32Array;

    const outWidth = width * 4;
    const outHeight = height * 4;

    const outputImageData = this.tensorToImageData(outputData, outWidth, outHeight);

    onProgress?.(100);

    return outputImageData;
  }

  private async upscaleWithTiling(
    imageData: ImageData,
    onProgress?: (progress: number) => void
  ): Promise<ImageData> {
    const { width, height, data } = imageData;
    const scale = 4;
    const tile = this.tileSize;
    const pad = this.tilePad;

    const outWidth = width * scale;
    const outHeight = height * scale;

    // Create output buffer
    const output = new Float32Array(3 * outHeight * outWidth);

    // Calculate number of tiles
    const tilesX = Math.ceil(width / tile);
    const tilesY = Math.ceil(height / tile);
    const totalTiles = tilesX * tilesY;
    let processedTiles = 0;

    onProgress?.(5);

    // Process each tile
    for (let y = 0; y < tilesY; y++) {
      for (let x = 0; x < tilesX; x++) {
        // Calculate tile bounds with padding
        const inX = x * tile;
        const inY = y * tile;
        const inW = Math.min(tile, width - inX);
        const inH = Math.min(tile, height - inY);

        // Add padding
        const padLeft = Math.min(pad, inX);
        const padTop = Math.min(pad, inY);
        const padRight = Math.min(pad, width - inX - inW);
        const padBottom = Math.min(pad, height - inY - inH);

        const tileX = inX - padLeft;
        const tileY = inY - padTop;
        const tileW = inW + padLeft + padRight;
        const tileH = inH + padTop + padBottom;

        // Extract tile and pad to fixed size for WebGL
        const tileData = this.extractTile(data, width, height, tileX, tileY, tileW, tileH);

        // Pad to fixed 136x136 if needed
        const paddedData = this.padToFixedSize(tileData, tileW, tileH, this.fixedInputSize);

        // Process tile with fixed dimensions
        const inputTensor = this.imageDataToTensor(paddedData, this.fixedInputSize, this.fixedInputSize);
        const feeds = { input: inputTensor };
        const results = await this.session!.run(feeds);
        const outputTensor = results.output;
        const tileOutput = outputTensor.data as Float32Array;

        // Copy to output (removing padding)
        const outTileX = inX * scale;
        const outTileY = inY * scale;
        const outTileW = inW * scale;
        const outTileH = inH * scale;
        const outPadLeft = padLeft * scale;
        const outPadTop = padTop * scale;

        // Output is fixed 544x544 (136 * 4)
        const fixedOutSize = this.fixedInputSize * scale;

        this.copyTileToOutput(
          tileOutput, fixedOutSize, fixedOutSize,
          output, outWidth, outHeight,
          outTileX, outTileY, outTileW, outTileH,
          outPadLeft, outPadTop
        );

        processedTiles++;
        onProgress?.(5 + (processedTiles / totalTiles) * 90);

        // Yield to UI thread to allow progress updates
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    const outputImageData = this.tensorToImageData(output, outWidth, outHeight);
    onProgress?.(100);

    return outputImageData;
  }

  private extractTile(
    data: Uint8ClampedArray,
    imgW: number,
    imgH: number,
    x: number,
    y: number,
    w: number,
    h: number
  ): Uint8ClampedArray {
    const tile = new Uint8ClampedArray(w * h * 4);

    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        const srcX = Math.min(Math.max(x + tx, 0), imgW - 1);
        const srcY = Math.min(Math.max(y + ty, 0), imgH - 1);
        const srcIdx = (srcY * imgW + srcX) * 4;
        const dstIdx = (ty * w + tx) * 4;

        tile[dstIdx] = data[srcIdx];
        tile[dstIdx + 1] = data[srcIdx + 1];
        tile[dstIdx + 2] = data[srcIdx + 2];
        tile[dstIdx + 3] = data[srcIdx + 3];
      }
    }

    return tile;
  }

  private padToFixedSize(
    data: Uint8ClampedArray,
    w: number,
    h: number,
    targetSize: number
  ): Uint8ClampedArray {
    if (w === targetSize && h === targetSize) {
      return data;
    }

    const padded = new Uint8ClampedArray(targetSize * targetSize * 4);

    // Copy original data and pad with edge pixels
    for (let y = 0; y < targetSize; y++) {
      for (let x = 0; x < targetSize; x++) {
        const srcX = Math.min(x, w - 1);
        const srcY = Math.min(y, h - 1);
        const srcIdx = (srcY * w + srcX) * 4;
        const dstIdx = (y * targetSize + x) * 4;

        padded[dstIdx] = data[srcIdx];
        padded[dstIdx + 1] = data[srcIdx + 1];
        padded[dstIdx + 2] = data[srcIdx + 2];
        padded[dstIdx + 3] = data[srcIdx + 3];
      }
    }

    return padded;
  }

  private copyTileToOutput(
    tile: Float32Array,
    tileW: number,
    tileH: number,
    output: Float32Array,
    outW: number,
    outH: number,
    dstX: number,
    dstY: number,
    copyW: number,
    copyH: number,
    srcOffsetX: number,
    srcOffsetY: number
  ): void {
    for (let c = 0; c < 3; c++) {
      for (let y = 0; y < copyH; y++) {
        for (let x = 0; x < copyW; x++) {
          const srcIdx = c * tileH * tileW + (y + srcOffsetY) * tileW + (x + srcOffsetX);
          const dstIdx = c * outH * outW + (dstY + y) * outW + (dstX + x);
          output[dstIdx] = tile[srcIdx];
        }
      }
    }
  }

  private imageDataToTensor(
    data: Uint8ClampedArray,
    width: number,
    height: number
  ): ort.Tensor {
    // Create Float32Array for RGB channels [1, 3, H, W]
    const float32Data = new Float32Array(3 * height * width);

    // Convert from [H, W, RGBA] to [1, 3, H, W] and normalize to [0, 1]
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = (y * width + x) * 4;
        const r = data[srcIdx] / 255;
        const g = data[srcIdx + 1] / 255;
        const b = data[srcIdx + 2] / 255;

        // Store in CHW format
        float32Data[0 * height * width + y * width + x] = r;
        float32Data[1 * height * width + y * width + x] = g;
        float32Data[2 * height * width + y * width + x] = b;
      }
    }

    return new ort.Tensor('float32', float32Data, [1, 3, height, width]);
  }

  private tensorToImageData(
    data: Float32Array,
    width: number,
    height: number
  ): ImageData {
    // Convert from [1, 3, H, W] to [H, W, RGBA]
    const rgba = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dstIdx = (y * width + x) * 4;

        // Get RGB from CHW format
        const r = data[0 * height * width + y * width + x];
        const g = data[1 * height * width + y * width + x];
        const b = data[2 * height * width + y * width + x];

        // Clamp and convert to [0, 255]
        rgba[dstIdx] = Math.min(255, Math.max(0, Math.round(r * 255)));
        rgba[dstIdx + 1] = Math.min(255, Math.max(0, Math.round(g * 255)));
        rgba[dstIdx + 2] = Math.min(255, Math.max(0, Math.round(b * 255)));
        rgba[dstIdx + 3] = 255; // Alpha
      }
    }

    return new ImageData(rgba, width, height);
  }

  dispose(): void {
    this.session?.release();
    this.session = null;
  }
}

// Helper to resize image to max dimension
export function resizeImage(
  img: HTMLImageElement,
  maxSize: number
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const ratio = maxSize / Math.max(img.width, img.height);
  const width = Math.round(img.width * ratio);
  const height = Math.round(img.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  return { canvas, width, height };
}

// Helper to get ImageData from canvas
export function getImageData(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext('2d')!;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// Helper to create canvas from ImageData
export function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
