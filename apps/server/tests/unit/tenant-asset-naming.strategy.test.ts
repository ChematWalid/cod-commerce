import { RandomAssetNamingStrategy } from '@cod/plugin-auth';
import { type TenantKeyScope, toBusinessId, toStoreId } from '@cod/shared';
import type { RequestContext } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { TenantAssetNamingStrategy } from '../../src/config/tenant-asset-naming.strategy';

const ctx = {} as RequestContext;
const business = toBusinessId('101');
const store = toStoreId('1001');

/** A strategy whose tenant lookup always answers `tenant`. */
const strategyFor = (tenant: TenantKeyScope | undefined) => new TenantAssetNamingStrategy(() => tenant);

describe('TenantAssetNamingStrategy (D2113, #210)', () => {
  it('keeps the random names of the repo strategy', () => {
    expect(strategyFor(undefined)).toBeInstanceOf(RandomAssetNamingStrategy);
  });

  it('prefixes a tenant upload with b/<business>/s/<store>/', () => {
    // Arrange
    const strategy = strategyFor({ businessId: business, storeId: store });

    // Act
    const source = strategy.generateSourceFileName(ctx, 'photo.jpg');
    const preview = strategy.generatePreviewFileName(ctx, source);

    // Assert
    expect(source).toMatch(/^b\/101\/s\/1001\/source\/[0-9a-f]{2}\/[0-9a-f]{32}\.jpg$/);
    expect(preview).toMatch(/^b\/101\/s\/1001\/preview\/[0-9a-f]{2}\/[0-9a-f]{32}__preview\.jpg$/);
  });

  it('prefixes a tenant context without an active store with b/<business>/', () => {
    // Arrange
    const strategy = strategyFor({ businessId: business });

    // Act
    const source = strategy.generateSourceFileName(ctx, 'logo.png');

    // Assert
    expect(source).toMatch(/^b\/101\/source\/[0-9a-f]{2}\/[0-9a-f]{32}\.png$/);
  });

  it('leaves a platform upload unprefixed', () => {
    // Arrange
    const strategy = strategyFor(undefined);

    // Act
    const source = strategy.generateSourceFileName(ctx, 'logo.png');

    // Assert
    expect(source).toMatch(/^source\/[0-9a-f]{2}\/[0-9a-f]{32}\.png$/);
  });

  it('derives the preview from the random part of a prefixed source name', () => {
    // Arrange
    const strategy = strategyFor({ businessId: business, storeId: store });
    const source = strategy.generateSourceFileName(ctx, 'a.webp');
    const random = source.split('/').at(-1)?.replace('.webp', '') ?? '';

    // Act
    const preview = strategy.generatePreviewFileName(ctx, source);

    // Assert
    expect(preview).toBe(`b/101/s/1001/preview/${random.slice(0, 2)}/${random}__preview.webp`);
  });
});
