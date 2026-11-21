import { describe, expect, it } from 'vitest';
import { decodePage } from '../../infrastructure/page-charset';

/** "Robe d'été" in iso-8859-1: é is one byte, 0xE9. */
const LATIN1_TITLE = Uint8Array.from([0x52, 0x6f, 0x62, 0x65, 0x20, 0x64, 0x27, 0xe9, 0x74, 0xe9]);
/** "قفطان" (kaftan) in windows-1256. */
const CP1256_KAFTAN = Uint8Array.from([0xde, 0xdd, 0xd8, 0xc7, 0xe4]);

const concat = (...parts: (string | Uint8Array)[]): Uint8Array =>
  Uint8Array.from(parts.flatMap((part) => [...(typeof part === 'string' ? new TextEncoder().encode(part) : part)]));

describe('decodePage (D2272)', () => {
  it('decodes in the charset the content-type declares', () => {
    // Act
    const latin = decodePage(LATIN1_TITLE, 'text/html; charset=ISO-8859-1');
    const arabic = decodePage(CP1256_KAFTAN, 'text/html;charset="windows-1256"');

    // Assert
    expect(latin).toBe("Robe d'été");
    expect(arabic).toBe('قفطان');
  });

  it('falls back to the meta charset, then UTF-8', () => {
    // Arrange
    const withMeta = concat('<html><head><meta charset="windows-1256"><title>', CP1256_KAFTAN, '</title>');
    const withHttpEquiv = concat(
      '<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1"><title>',
      LATIN1_TITLE,
    );

    // Act and Assert
    expect(decodePage(withMeta, 'text/html')).toContain('قفطان');
    expect(decodePage(withHttpEquiv, 'text/html')).toContain("Robe d'été");
    expect(decodePage(new TextEncoder().encode('قفطان'), 'text/html')).toBe('قفطان');
  });

  it('an unknown charset label falls back to UTF-8', () => {
    // Act
    const text = decodePage(new TextEncoder().encode('été'), 'text/html; charset=x-unknown-charset');

    // Assert
    expect(text).toBe('été');
  });
});
