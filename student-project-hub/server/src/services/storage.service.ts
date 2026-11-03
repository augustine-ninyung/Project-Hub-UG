import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

export interface StoredFile {
  url: string;
  /** Provider-relative path, used for deletion. */
  path: string;
}

type ImagePreset = 'cover' | 'screenshot' | 'avatar';

const PRESETS: Record<ImagePreset, { width: number; height?: number; fit: 'inside' | 'cover' }> = {
  cover: { width: 1600, height: 900, fit: 'inside' },
  screenshot: { width: 1920, height: 1440, fit: 'inside' },
  avatar: { width: 400, height: 400, fit: 'cover' },
};

export const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), env.LOCAL_UPLOAD_DIR);

interface StorageProvider {
  put(key: string, data: Buffer, contentType: string): Promise<StoredFile>;
  remove(paths: string[]): Promise<void>;
}

class SupabaseStorage implements StorageProvider {
  private client: SupabaseClient;

  constructor(url: string, key: string, private bucket: string) {
    this.client = createClient(url, key, { auth: { persistSession: false } });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<StoredFile> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(key, data, { contentType, cacheControl: '31536000', upsert: false });
    if (error) throw new ApiError(502, `Image upload failed: ${error.message}`, 'STORAGE_ERROR');
    const { data: pub } = this.client.storage.from(this.bucket).getPublicUrl(key);
    return { url: pub.publicUrl, path: key };
  }

  async remove(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const { error } = await this.client.storage.from(this.bucket).remove(paths);
    if (error) console.error('Failed to delete images from storage:', error.message);
  }
}

/** Development fallback when Supabase is not configured. Served at /uploads. */
class LocalStorage implements StorageProvider {
  async put(key: string, data: Buffer): Promise<StoredFile> {
    const target = path.join(LOCAL_UPLOAD_DIR, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
    return { url: `${env.API_URL}/uploads/${key}`, path: key };
  }

  async remove(paths: string[]): Promise<void> {
    await Promise.all(
      paths.map((p) => unlink(path.join(LOCAL_UPLOAD_DIR, p)).catch(() => undefined)),
    );
  }
}

const provider: StorageProvider =
  env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? new SupabaseStorage(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_BUCKET)
    : new LocalStorage();

/**
 * Decodes, resizes and re-encodes an uploaded image as WebP, then stores it.
 * Re-encoding validates the file is a genuine image and strips EXIF data.
 */
export async function storeImage(file: Express.Multer.File, folder: string, preset: ImagePreset) {
  return storeImageBuffer(file.buffer, folder, preset, file.originalname);
}

export async function storeImageBuffer(
  input: Buffer,
  folder: string,
  preset: ImagePreset,
  name = 'image',
) {
  const { width, height, fit } = PRESETS[preset];
  let output: Buffer;
  try {
    output = await sharp(input, { animated: false, limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width, height, fit, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw ApiError.badRequest(`"${name}" is not a valid image`);
  }
  return provider.put(`${folder}/${randomUUID()}.webp`, output, 'image/webp');
}

export async function removeImages(paths: (string | null | undefined)[]) {
  await provider.remove(paths.filter((p): p is string => Boolean(p)));
}
