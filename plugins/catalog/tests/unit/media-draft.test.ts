import { MAX_PRODUCT_ASSETS } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { withImages, withoutImage } from '../../dashboard/model/media-draft';

const none = { assetIds: [] as readonly string[], featuredAssetId: null };

describe('media draft', () => {
  it('features the first image a product gets and keeps a chosen one', () => {
    // Act
    const first = withImages(none, ['7', '8']);
    const more = withImages({ assetIds: ['7'], featuredAssetId: '7' }, ['8', '7']);

    // Assert
    expect(first).toEqual({ assetIds: ['7', '8'], featuredAssetId: '7' });
    expect(more).toEqual({ assetIds: ['8', '7'], featuredAssetId: '7' });
  });

  it('features the next image when the featured one is removed, and none when the last goes', () => {
    // Act
    const next = withoutImage({ assetIds: ['7', '8'], featuredAssetId: '7' }, '7');
    const last = withoutImage({ assetIds: ['8'], featuredAssetId: '8' }, '8');

    // Assert
    expect(next).toEqual({ assetIds: ['8'], featuredAssetId: '8' });
    expect(last).toEqual(none);
  });

  it('keeps at most the cap of images per product', () => {
    // Act
    const capped = withImages(
      none,
      Array.from({ length: MAX_PRODUCT_ASSETS + 3 }, (_, i) => String(i + 1)),
    );

    // Assert
    expect(capped.assetIds).toHaveLength(MAX_PRODUCT_ASSETS);
  });
});
