import { LOGO_MAX_BYTES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { BusinessLogoService } from '../../application/business-logo.service';
import { LogoTooLargeError, LogoTypeError } from '../../domain/errors';
import type { LogoAssetsPort, LogoImageFile } from '../../domain/ports/logo-assets.port';
import type { OperationContext } from '../../domain/ports/operation-context';

const ctx = {} as OperationContext;
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

class RecordingAssets implements LogoAssetsPort {
  readonly stored: LogoImageFile[] = [];

  store(_ctx: OperationContext, file: LogoImageFile): Promise<string> {
    this.stored.push(file);
    return Promise.resolve('41');
  }
}

const pngOfSize = (size: number): Uint8Array => {
  const content = new Uint8Array(size);
  content.set(PNG_HEAD);
  return content;
};

describe('BusinessLogoService', () => {
  it('stores an image of exactly the limit and returns the asset id', async () => {
    // Arrange
    const assets = new RecordingAssets();

    // Act
    const result = await new BusinessLogoService(assets).upload(ctx, pngOfSize(LOGO_MAX_BYTES));

    // Assert
    expect(result).toEqual({ assetId: '41' });
    expect(assets.stored[0]?.type.mimeType).toBe('image/png');
  });

  it('refuses one byte over the limit before looking at the content, and stores nothing', async () => {
    // Arrange
    const assets = new RecordingAssets();

    // Act
    const upload = new BusinessLogoService(assets).upload(ctx, new Uint8Array(LOGO_MAX_BYTES + 1));

    // Assert
    await expect(upload).rejects.toBeInstanceOf(LogoTooLargeError);
    expect(assets.stored).toEqual([]);
  });

  it('refuses bytes that are not an accepted image and stores nothing', async () => {
    // Arrange
    const assets = new RecordingAssets();
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

    // Act
    const upload = new BusinessLogoService(assets).upload(ctx, svg);

    // Assert
    await expect(upload).rejects.toBeInstanceOf(LogoTypeError);
    expect(assets.stored).toEqual([]);
  });
});
