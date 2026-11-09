import type { AssetPreviewStrategy, RequestContext } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { ContentCheckedPreviewStrategy } from '../../infrastructure/asset-content-guard';

const ctx = {} as RequestContext;
const PREVIEW = Buffer.from('preview');
const delegate: AssetPreviewStrategy = { generatePreviewImage: () => Promise.resolve(PREVIEW) };
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('ContentCheckedPreviewStrategy', () => {
  it('passes an image whose bytes are an accepted format to the real strategy', async () => {
    await expect(new ContentCheckedPreviewStrategy(delegate).generatePreviewImage(ctx, 'image/png', PNG)).resolves.toBe(
      PREVIEW,
    );
  });

  it('refuses an image type whose bytes are something else', async () => {
    const guarded = new ContentCheckedPreviewStrategy(delegate);

    await expect(guarded.generatePreviewImage(ctx, 'image/png', Buffer.from('<svg/>'))).rejects.toMatchObject({
      extensions: { code: 'auth.image-type' },
    });
  });

  it('leaves other file types to the real strategy', async () => {
    await expect(
      new ContentCheckedPreviewStrategy(delegate).generatePreviewImage(ctx, 'application/pdf', Buffer.from('%PDF')),
    ).resolves.toBe(PREVIEW);
  });
});
