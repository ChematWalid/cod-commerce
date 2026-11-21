import { IMPORT_MAX_IMAGE_URLS, IMPORT_MAX_URL_CHARS } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { parseImageUrls } from '../../domain/image-urls';

describe('parseImageUrls (D2209)', () => {
  it('only http/https', () => {
    // Act and Assert
    expect(parseImageUrls('https://img.example/a.jpg; http://img.example/b.png')).toEqual({
      ok: true,
      urls: ['https://img.example/a.jpg', 'http://img.example/b.png'],
    });
    expect(parseImageUrls('ftp://img.example/a.jpg')).toEqual({ ok: false });
    expect(parseImageUrls('javascript:alert(1)')).toEqual({ ok: false });
    expect(parseImageUrls('img.example/a.jpg')).toEqual({ ok: false });
  });

  it('a URL over 2 048 chars refused', () => {
    // Arrange
    const long = `https://img.example/${'a'.repeat(IMPORT_MAX_URL_CHARS)}`;

    // Act and Assert
    expect(parseImageUrls(long)).toEqual({ ok: false });
  });

  it('more than 10 URLs refused', () => {
    // Arrange
    const many = Array.from(
      { length: IMPORT_MAX_IMAGE_URLS + 1 },
      (_, index) => `https://img.example/${String(index)}`,
    );

    // Act and Assert
    expect(parseImageUrls(many.join(';'))).toEqual({ ok: false });
    expect(parseImageUrls(many.slice(1).join(';'))).toMatchObject({ ok: true });
  });

  it('an empty cell holds no link', () => {
    // Act and Assert
    expect(parseImageUrls('  ')).toEqual({ ok: true, urls: [] });
  });
});
