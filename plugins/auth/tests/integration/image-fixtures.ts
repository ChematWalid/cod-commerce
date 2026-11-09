import { LOGO_MAX_BYTES } from '@cod/shared';
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
