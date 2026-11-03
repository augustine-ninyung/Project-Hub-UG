import multer from 'multer';
import { ApiError } from '../utils/api-error.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_SCREENSHOTS = 8;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/**
 * Files are buffered in memory (bounded by the limits below) and never touch
 * disk unprocessed. The declared MIME type is only a first filter: the storage
 * service re-decodes every file with sharp, which rejects anything that is not
 * actually an image, and re-encodes it (stripping metadata/payloads).
 */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_SCREENSHOTS + 1, fields: 20 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(ApiError.badRequest('Only JPEG, PNG, WebP or GIF images are allowed'));
      return;
    }
    cb(null, true);
  },
});
