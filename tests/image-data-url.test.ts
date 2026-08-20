import { describe, expect, it } from 'vitest';
import { dataUrlToBlob } from '../services/api';

describe('image data URL decoding', () => {
  it('decodes base64 image bytes without making a data URL network request', async () => {
    const blob = await dataUrlToBlob('data:image/png;base64,iVBORw0KGgo=');

    expect(blob.type).toBe('image/png');
    expect(Array.from(new Uint8Array(await blob.arrayBuffer()))).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
  });

  it('decodes percent-encoded data URLs', async () => {
    const blob = await dataUrlToBlob('data:text/plain,profile%20photo');

    expect(blob.type).toBe('text/plain');
    expect(await blob.text()).toBe('profile photo');
  });

  it('rejects malformed image data', async () => {
    await expect(dataUrlToBlob('not-an-image')).rejects.toThrow('Invalid image data.');
  });
});
