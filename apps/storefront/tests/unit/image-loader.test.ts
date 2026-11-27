import { afterEach, describe, expect, it, vi } from 'vitest';
import { toAssetPath } from '../../src/images/asset-path';
import { assetSource, imageUrl } from '../../src/images/asset-source';
import storefrontImageLoader, { presetFor } from '../../src/images/loader';

const BASE = 'https://assets.example.dz/assets';

describe('image loader', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    [640, 'medium'],
    [1200, 'large'],
    [10, 'tiny'],
    [150, 'thumb'],
    [301, 'small'],
  ])('maps a width of %i to the %s preset', (width, preset) => {
    expect(presetFor(width)).toBe(preset);
  });

  it('builds the asset server URL of a storage path with the nearest preset', () => {
    // Act
    const url = imageUrl('b/1/s/2/preview/ab/shoe__preview.jpg', 640, BASE);
    // Assert
    expect(url).toBe(`${BASE}/b/1/s/2/preview/ab/shoe__preview.jpg?preset=medium`);
  });

  it('encodes each path segment, so a path can never add a query or leave the asset route', () => {
    expect(imageUrl('b/1/a b?x=1#f.jpg', 50, BASE)).toBe(`${BASE}/b/1/a%20b%3Fx%3D1%23f.jpg?preset=tiny`);
  });

  it('reads STOREFRONT_ASSET_BASE on each call, without a trailing slash', () => {
    // Arrange
    vi.stubEnv('STOREFRONT_ASSET_BASE', `${BASE}/`);
    // Act
    const source = assetSource('p.jpg');
    // Assert
    expect(source).toBe(`${BASE}/p.jpg`);
  });

  it('falls back to the same-origin asset route when STOREFRONT_ASSET_BASE is not set', () => {
    vi.stubEnv('STOREFRONT_ASSET_BASE', '');
    expect(assetSource('p.jpg')).toBe('/assets/p.jpg');
  });

  it('as the next/image loader, adds only the nearest preset to a source built on the server', () => {
    // Arrange: the browser has no STOREFRONT_ASSET_BASE; the source already carries the base.
    vi.stubEnv('STOREFRONT_ASSET_BASE', '');
    // Act
    const url = storefrontImageLoader({ src: `${BASE}/p.jpg`, width: 640 });
    // Assert
    expect(url).toBe(`${BASE}/p.jpg?preset=medium`);
  });
});

describe('asset path of an api image (D3217 b)', () => {
  it('keeps a product preview, which is already a storage path', () => {
    expect(toAssetPath('b/1/s/2/preview/ab/shoe__preview.jpg')).toBe('b/1/s/2/preview/ab/shoe__preview.jpg');
  });

  it('turns a collection preview, an absolute asset server URL, into the same storage path', () => {
    expect(toAssetPath('http://api.internal:3000/assets/b/1/s/2/preview/ab/shoe__preview.jpg')).toBe(
      'b/1/s/2/preview/ab/shoe__preview.jpg',
    );
  });

  it('gives the two forms of one image the same loader URL', () => {
    // Arrange
    const productPreview = 'b/1/s/2/preview/x.jpg';
    const collectionPreview = 'https://api.example.dz/assets/b/1/s/2/preview/x.jpg';
    // Act
    const fromProduct = imageUrl(toAssetPath(productPreview) ?? '', 500, BASE);
    const fromCollection = imageUrl(toAssetPath(collectionPreview) ?? '', 500, BASE);
    // Assert
    expect(fromCollection).toBe(fromProduct);
  });

  it.each([
    null,
    '',
    'https://api.example.dz/elsewhere/x.jpg',
    'javascript:alert(1)',
    '/assets/../x.jpg',
    'https://api.example.dz/assets/%E0.jpg',
  ])('gives no image for %j', (value) => {
    expect(toAssetPath(value)).toBeNull();
  });

  it('drops a leading slash of a relative asset route', () => {
    expect(toAssetPath('/assets/b/1/x.jpg')).toBe('b/1/x.jpg');
  });
});
