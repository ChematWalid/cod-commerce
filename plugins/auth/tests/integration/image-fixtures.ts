import { randomBytes } from 'node:crypto';
import { LOGO_MAX_BYTES } from '@cod/shared';
import sharp from 'sharp';
import { MAX_IMAGE_PIXELS } from '../../domain/image-format';
import type { UploadedTestFile } from './login-test-client';

/** A 1x1 PNG, the smallest real image the asset pipeline can make a preview of. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const SVG_WITH_SCRIPT = `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><script>alert(1)</script></svg>`;

/** A real PNG, with zeros after its end chunk up to `size` bytes (decoders stop at the end chunk). */
export function pngOfSize(size: number = PNG_1X1.length): Buffer {
  return Buffer.concat([PNG_1X1, Buffer.alloc(Math.max(0, size - PNG_1X1.length))]);
}

export const png = (claimedType = 'image/png', name = 'logo.png'): UploadedTestFile => ({
  bytes: PNG_1X1,
  claimedType,
  name,
});

export const pngAtLimit = (): UploadedTestFile => ({
  bytes: pngOfSize(LOGO_MAX_BYTES),
  claimedType: 'image/png',
  name: 'big.png',
});

export const pngOverLimit = (): UploadedTestFile => ({
  bytes: pngOfSize(LOGO_MAX_BYTES + 1),
  claimedType: 'image/png',
  name: 'big.png',
});

/** Text that a client calls a PNG. */
export const textClaimingPng = (): UploadedTestFile => ({
  bytes: Buffer.from('this is not an image, whatever the file name says'),
  claimedType: 'image/png',
  name: 'logo.png',
});

/** Markup that can carry script, under whatever type and name a client chooses. */
export const svg = (claimedType = 'image/svg+xml', name = 'logo.svg'): UploadedTestFile => ({
  bytes: Buffer.from(SVG_WITH_SCRIPT),
  claimedType,
  name,
});

/** A PNG signature followed by text: the first bytes pass a signature check, the body cannot be decoded. */
export const pngSignatureThenText = (): UploadedTestFile => ({
  bytes: Buffer.concat([PNG_1X1.subarray(0, 8), Buffer.from('then only text, no image chunks at all')]),
  claimedType: 'image/png',
  name: 'logo.png',
});

/** A real, noisy PNG cut in half: a valid header and a body that ends early. */
export async function truncatedPng(): Promise<UploadedTestFile> {
  const size = 200;
  const whole = await sharp(randomBytes(size * size * 3), { raw: { width: size, height: size, channels: 3 } })
    .png()
    .toBuffer();
  return { bytes: whole.subarray(0, Math.floor(whole.length / 2)), claimedType: 'image/png', name: 'cut.png' };
}

/** A solid PNG just over the pixel cap: a few kilobytes on the wire. */
export async function pngOverPixelCap(): Promise<UploadedTestFile> {
  const width = 8000;
  const height = Math.ceil(MAX_IMAGE_PIXELS / width) + 1;
  const bytes = await sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { bytes, claimedType: 'image/png', name: 'huge.png' };
}
