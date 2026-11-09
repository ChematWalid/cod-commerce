import type { AssetPreviewStrategy, RequestContext } from '@vendure/core';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_PIXELS } from '../../domain/image-format';
import { ContentCheckedPreviewStrategy } from '../../infrastructure/asset-content-guard';

const ctx = {} as RequestContext;
const PREVIEW = Buffer.from('preview');
const delegate: AssetPreviewStrategy = { generatePreviewImage: () => Promise.resolve(PREVIEW) };
const guarded = new ContentCheckedPreviewStrategy(delegate);
const REFUSED = { extensions: { code: 'auth.image-type' } };

const realPng = (width = 4, height = 4): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background: '#336699' } })
    .png()
    .toBuffer();

describe('ContentCheckedPreviewStrategy', () => {
  it('passes an image that decodes to the real strategy', async () => {
    await expect(guarded.generatePreviewImage(ctx, 'image/png', await realPng())).resolves.toBe(PREVIEW);
  });

  it('refuses an image type whose bytes are something else', async () => {
    await expect(guarded.generatePreviewImage(ctx, 'image/png', Buffer.from('<svg/>'))).rejects.toMatchObject(REFUSED);
  });

  it('refuses a PNG signature followed by text', async () => {
    const forged = Buffer.concat([(await realPng()).subarray(0, 8), Buffer.from('not image chunks')]);

    await expect(guarded.generatePreviewImage(ctx, 'image/png', forged)).rejects.toMatchObject(REFUSED);
  });

  it('refuses a real PNG whose body ends early', async () => {
    const whole = await realPng(64, 64);

    await expect(
      guarded.generatePreviewImage(ctx, 'image/png', whole.subarray(0, Math.floor(whole.length / 2))),
    ).rejects.toMatchObject(REFUSED);
  });

  it('refuses an image over the pixel cap from its header, and accepts one at the cap', async () => {
    const width = 8000;
    const atCap = await realPng(width, MAX_IMAGE_PIXELS / width);
    const overCap = await realPng(width, MAX_IMAGE_PIXELS / width + 1);

    await expect(guarded.generatePreviewImage(ctx, 'image/png', atCap)).resolves.toBe(PREVIEW);
    await expect(guarded.generatePreviewImage(ctx, 'image/png', overCap)).rejects.toMatchObject(REFUSED);
  });

  it('leaves other file types to the real strategy', async () => {
    await expect(guarded.generatePreviewImage(ctx, 'application/pdf', Buffer.from('%PDF'))).resolves.toBe(PREVIEW);
  });
});
