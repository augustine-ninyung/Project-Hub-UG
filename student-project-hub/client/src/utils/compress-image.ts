import { ClientError } from '@/services/api';

const MAX_DIMENSION = 1920;
const QUALITY = 0.85;
/** Vercel rejects request bodies over 4.5 MB; leave room for form overhead. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

function encode(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/**
 * Downscales and re-encodes an image in the browser so uploads stay small.
 * The server decodes and re-encodes every image anyway, so nothing is lost.
 * Returns the original file if the browser can't process it or the result
 * isn't smaller.
 */
export async function compressImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    // Safari can't encode WebP and silently returns PNG; JPEG is the fallback.
    let blob = await encode(canvas, 'image/webp');
    if (blob?.type !== 'image/webp') blob = await encode(canvas, 'image/jpeg');
    if (!blob || blob.size >= file.size) return file;

    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.${ext}`, { type: blob.type });
  } catch {
    return file;
  }
}

/** Compresses every file and checks the combined size fits in one request. */
export async function prepareUploads(files: File[]): Promise<File[]> {
  const prepared = await Promise.all(files.map(compressImage));
  const total = prepared.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_UPLOAD_BYTES) {
    throw new ClientError(
      'These images are too large to upload together. Remove a few screenshots, or upload them in a later edit.',
    );
  }
  return prepared;
}
