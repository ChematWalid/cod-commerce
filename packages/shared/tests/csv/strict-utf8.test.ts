import { describe, expect, it } from 'vitest';
import { strictUtf8Text } from '../../src/csv/strict-utf8';

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

describe('strictUtf8Text (D2209, D3142)', () => {
  it('reads UTF-8 text as it is', () => {
    // Act
    const text = strictUtf8Text(utf8('level,provinceCode\r\nwilaya,16\r\n'));

    // Assert
    expect(text).toBe('level,provinceCode\r\nwilaya,16\r\n');
  });

  it('drops the byte order mark Excel writes', () => {
    // Arrange
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8('أدرار')]);

    // Act
    const text = strictUtf8Text(bytes);

    // Assert
    expect(text).toBe('أدرار');
  });

  it('drops only one byte order mark', () => {
    // Act
    const text = strictUtf8Text(utf8('﻿﻿x'));

    // Assert
    expect(text).toBe('﻿x');
  });

  it.each([
    ['a Latin-1 é', [0x63, 0x61, 0x66, 0xe9]],
    ['a lone continuation byte', [0x80]],
    ['a truncated sequence', [0xe2, 0x82]],
    ['an overlong encoding', [0xc0, 0xaf]],
  ])('answers undefined for %s', (_label, bytes) => {
    // Act
    const text = strictUtf8Text(new Uint8Array(bytes));

    // Assert
    expect(text).toBeUndefined();
  });

  it('reads no bytes as empty text', () => {
    // Act and Assert
    expect(strictUtf8Text(new Uint8Array())).toBe('');
  });
});
