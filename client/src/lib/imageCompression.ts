/**
 * Client-side image compression utility.
 *
 * Resizes images to a maximum dimension and converts them to JPEG with
 * configurable quality. Designed to reduce upload size on mobile devices
 * where photos from the camera can be 5-10 MB.
 *
 * Usage:
 *   const compressed = await compressImage(file);
 *   // compressed.file  → File ready to upload (JPEG)
 *   // compressed.preview → data URL for instant preview
 *   // compressed.originalSize / compressed.compressedSize → bytes
 */

export interface CompressImageOptions {
  /** Maximum width or height in pixels. Default: 1200 */
  maxDimension?: number;
  /** JPEG quality 0-1. Default: 0.82 */
  quality?: number;
  /** Maximum file size in bytes before compression is applied. Default: 500KB */
  skipBelowBytes?: number;
  /** Output MIME type. Default: 'image/jpeg' */
  outputType?: 'image/jpeg' | 'image/webp';
}

export interface CompressImageResult {
  file: File;
  preview: string;
  originalSize: number;
  compressedSize: number;
  wasCompressed: boolean;
  width: number;
  height: number;
}

const DEFAULT_OPTIONS: Required<CompressImageOptions> = {
  maxDimension: 1200,
  quality: 0.82,
  skipBelowBytes: 500 * 1024, // 500 KB
  outputType: 'image/jpeg',
};

/**
 * Load a File as an HTMLImageElement.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Draw an image onto a canvas with the target dimensions and return the
 * resulting Blob + data URL.
 */
function canvasCompress(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  quality: number,
  outputType: string,
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas 2D context not available'));
      return;
    }

    // Use high-quality downscaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const dataUrl = canvas.toDataURL(outputType, quality);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas toBlob returned null'));
          return;
        }
        resolve({ blob, dataUrl });
      },
      outputType,
      quality,
    );
  });
}

/**
 * Calculate target dimensions preserving aspect ratio.
 */
export function calculateDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number; scaled: boolean } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height, scaled: false };
  }

  const ratio = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
    scaled: true,
  };
}

/**
 * Compress an image File. Returns a new File (JPEG) with reduced dimensions
 * and file size. If the file is already small enough, it is returned as-is.
 */
export async function compressImage(
  file: File,
  options?: CompressImageOptions,
): Promise<CompressImageResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Skip non-image files
  if (!file.type.startsWith('image/')) {
    return {
      file,
      preview: '',
      originalSize: file.size,
      compressedSize: file.size,
      wasCompressed: false,
      width: 0,
      height: 0,
    };
  }

  // Skip small files that don't need compression
  if (file.size <= opts.skipBelowBytes) {
    const preview = URL.createObjectURL(file);
    const img = await loadImage(file);
    const result: CompressImageResult = {
      file,
      preview,
      originalSize: file.size,
      compressedSize: file.size,
      wasCompressed: false,
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
    URL.revokeObjectURL(img.src);
    return result;
  }

  const img = await loadImage(file);
  const { width: tw, height: th } = calculateDimensions(
    img.naturalWidth,
    img.naturalHeight,
    opts.maxDimension,
  );

  const { blob, dataUrl } = await canvasCompress(img, tw, th, opts.quality, opts.outputType);

  // Clean up object URL
  URL.revokeObjectURL(img.src);

  // Build the output filename
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const ext = opts.outputType === 'image/webp' ? 'webp' : 'jpg';
  const compressedFile = new File([blob], `${baseName}.${ext}`, {
    type: opts.outputType,
    lastModified: Date.now(),
  });

  return {
    file: compressedFile,
    preview: dataUrl,
    originalSize: file.size,
    compressedSize: compressedFile.size,
    wasCompressed: true,
    width: tw,
    height: th,
  };
}

/**
 * Compress multiple image files in parallel.
 */
export async function compressImages(
  files: File[],
  options?: CompressImageOptions,
): Promise<CompressImageResult[]> {
  return Promise.all(files.map((f) => compressImage(f, options)));
}

/**
 * Format bytes to a human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Calculate compression ratio as a percentage saved.
 */
export function compressionSavings(original: number, compressed: number): number {
  if (original === 0) return 0;
  return Math.round(((original - compressed) / original) * 100);
}
