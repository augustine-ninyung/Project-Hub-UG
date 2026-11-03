import { createHash, randomBytes } from 'node:crypto';

/** Opaque, URL-safe random token (refresh tokens, email links). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Tokens are stored hashed so a database leak does not expose live tokens. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
