import { describe, expect, it } from 'vitest';
import { detectImageFormat } from '../../domain/image-format';

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);
const ascii = (text: string): number[] => [...Buffer.from(text, 'ascii')];

describe('detectImageFormat', () => {
  it.each([
    ['PNG', bytes(0x89, ...ascii('PNG'), 0x0d, 0x0a, 0x1a, 0x0a, 0), 'image/png'],
    ['JPEG', bytes(0xff, 0xd8, 0xff, 0xe0, 0), 'image/jpeg'],
    ['GIF87a', bytes(...ascii('GIF87a'), 0), 'image/gif'],
    ['GIF89a', bytes(...ascii('GIF89a'), 0), 'image/gif'],
    ['WebP', bytes(...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WEBP'), 0), 'image/webp'],
  ])('recognises %s by its first bytes', (_name, content, mimeType) => {
    expect(detectImageFormat(content)?.mimeType).toBe(mimeType);
  });

  it.each([
    ['SVG markup', bytes(...ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))],
    ['XML', bytes(...ascii('<?xml version="1.0"?><svg/>'))],
    ['plain text', bytes(...ascii('hello'))],
    ['a RIFF file that is not WebP', bytes(...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WAVE'))],
    ['a truncated PNG signature', bytes(0x89, ...ascii('PNG'))],
    ['an empty file', bytes()],
  ])('refuses %s', (_name, content) => {
    expect(detectImageFormat(content)).toBeUndefined();
  });
});
