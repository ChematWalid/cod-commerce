import { crc32, deflateSync } from 'node:zlib';

/** The side of a demo product image, in pixels: large enough for the storefront's `large` preset (800) to scale down. */
export const DEMO_IMAGE_SIZE = 800;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const RGB_CHANNELS = 3;
const BIT_DEPTH = 8;
/** PNG colour type 2: truecolour without alpha. */
const COLOR_TYPE_RGB = 2;
/** Each scanline starts with its filter type; 0 is none. */
const FILTER_NONE = 0;
const HEX_COLOR = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** The colour of a demo image is not `#rrggbb`: a bug in the demo catalog, so the seed stops. */
export class InvalidDemoColorError extends Error {
  constructor() {
    super('A demo image colour must be written #rrggbb');
    this.name = 'InvalidDemoColorError';
  }
}

function rgbOf(color: string): readonly [number, number, number] {
  const match = HEX_COLOR.exec(color);
  if (match === null) throw new InvalidDemoColorError();
  const [, red = '', green = '', blue = ''] = match;
  return [Number.parseInt(red, 16), Number.parseInt(green, 16), Number.parseInt(blue, 16)];
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, checksum]);
}

function headerOf(size: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.writeUInt8(BIT_DEPTH, 8);
  header.writeUInt8(COLOR_TYPE_RGB, 9);
  return header;
}

/**
 * A square PNG of one colour: the synthetic image of a demo product (P3.S2). Written by hand so the seed needs no
 * image library, no download and no file: the media library reads the format from the bytes as for any upload.
 *
 * @throws {@link InvalidDemoColorError} when `color` is not `#rrggbb`
 */
export function demoImagePng(color: string, size: number = DEMO_IMAGE_SIZE): Uint8Array {
  const rgb = Buffer.from(rgbOf(color));
  const row = Buffer.alloc(1 + size * RGB_CHANNELS);
  row.writeUInt8(FILTER_NONE, 0);
  for (let pixel = 0; pixel < size; pixel += 1) rgb.copy(row, 1 + pixel * RGB_CHANNELS);
  const pixels = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', headerOf(size)),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
