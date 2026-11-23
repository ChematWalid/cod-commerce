import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { DEMO_IMAGE_SIZE, demoImagePng, InvalidDemoColorError } from '../../src/seed/demo-image';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** The chunks of a PNG, by type, in order. */
function chunksOf(png: Uint8Array): { type: string; data: Buffer }[] {
  const bytes = Buffer.from(png);
  const chunks: { type: string; data: Buffer }[] = [];
  for (let offset = PNG_SIGNATURE.length; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    chunks.push({
      type: bytes.toString('latin1', offset + 4, offset + 8),
      data: bytes.subarray(offset + 8, offset + 8 + length),
    });
    offset += length + 12;
  }
  return chunks;
}

describe('demoImagePng', () => {
  it('writes a square RGB PNG of the demo size', () => {
    // Act
    const png = demoImagePng('#b03a2e');

    // Assert
    expect([...png.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
    const [header] = chunksOf(png);
    expect(header?.type).toBe('IHDR');
    expect(header?.data.readUInt32BE(0)).toBe(DEMO_IMAGE_SIZE);
    expect(header?.data.readUInt32BE(4)).toBe(DEMO_IMAGE_SIZE);
    expect(chunksOf(png).map((chunk) => chunk.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
  });

  it('fills every pixel with the colour', () => {
    // Act
    const png = demoImagePng('#2e86c1');

    // Assert
    const pixels = inflateSync(chunksOf(png).find((chunk) => chunk.type === 'IDAT')?.data ?? Buffer.alloc(0));
    const row = pixels.subarray(0, 1 + DEMO_IMAGE_SIZE * 3);
    expect(row[0]).toBe(0);
    expect([...row.subarray(1, 4)]).toEqual([0x2e, 0x86, 0xc1]);
    expect(pixels.length).toBe((1 + DEMO_IMAGE_SIZE * 3) * DEMO_IMAGE_SIZE);
  });

  it('refuses a colour that is not #rrggbb', () => {
    // Act and Assert
    expect(() => demoImagePng('red')).toThrow(InvalidDemoColorError);
  });
});
