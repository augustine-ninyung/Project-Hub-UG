import { describe, expect, it } from 'vitest';
import { ClientError, getErrorMessage } from '@/services/api';
import { MAX_UPLOAD_BYTES, prepareUploads } from '@/utils/compress-image';

const file = (bytes: number, name = 'shot.png') =>
  new File([new Uint8Array(bytes)], name, { type: 'image/png' });

describe('prepareUploads', () => {
  it('passes files through when the browser cannot re-encode them', async () => {
    const files = [file(1000, 'a.png'), file(2000, 'b.png')];
    await expect(prepareUploads(files)).resolves.toEqual(files);
  });

  it('rejects a set of images that would exceed the request limit', async () => {
    const half = Math.ceil(MAX_UPLOAD_BYTES / 2) + 1;
    const error = await prepareUploads([file(half), file(half)]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ClientError);
    expect(getErrorMessage(error)).toMatch(/too large to upload together/);
  });
});
