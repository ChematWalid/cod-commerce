import type { RequestContext } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { RandomAssetNamingStrategy } from '../../infrastructure/random-asset-naming.strategy';

const ctx = {} as RequestContext;
const strategy = new RandomAssetNamingStrategy();

describe('RandomAssetNamingStrategy', () => {
  it('names two files with one original name differently, and never uses that name', () => {
    // Act
    const first = strategy.generateSourceFileName(ctx, 'logo.png');
    const second = strategy.generateSourceFileName(ctx, 'logo.png');

    // Assert
    expect(first).not.toBe(second);
    expect(first).toMatch(/^source\/[0-9a-f]{2}\/[0-9a-f]{32}\.png$/);
    expect(first).not.toContain('logo');
  });

  it('derives the preview name from the stored source name', () => {
    // Arrange
    const source = strategy.generateSourceFileName(ctx, 'photo.jpg');
    const random = source.split('/').at(-1)?.replace('.jpg', '') ?? '';

    // Act
    const preview = strategy.generatePreviewFileName(ctx, source);

    // Assert
    expect(preview).toBe(`preview/${random.slice(0, 2)}/${random}__preview.jpg`);
  });

  it.each([
    ['an extension with a path in it', 'a.p/../ng'],
    ['an overlong extension', 'a.abcdefghij'],
    ['no extension', 'README'],
  ])('keeps %s out of the name', (_label, original) => {
    expect(strategy.generateSourceFileName(ctx, original)).toMatch(/^source\/[0-9a-f]{2}\/[0-9a-f]{32}$/);
  });
});
