import { toBusinessId, toStoreId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { LogoUrlService } from '../../application/logo-url.service';
import type { AssetAccessPort } from '../../domain/ports/asset-access.port';
import { asOperationContext } from '../../domain/ports/operation-context';
import type { PlatformStorePort } from '../../domain/ports/platform-store.port';
import type { StoreAccess } from '../../domain/store';

const ctx = asOperationContext({});
const BUSINESS_A = toBusinessId('101');
const BUSINESS_B = toBusinessId('102');
const ASSET_OF_A = 5;
const ASSET_OF_B = 6;

const access = (id: string, channelId: number): StoreAccess => ({ id: toStoreId(id), channelId, status: 'active' });

/** Business A's stores sit on channels 2 and 3, business B's on channel 4. */
const STORES: Readonly<Record<string, readonly StoreAccess[]>> = {
  [BUSINESS_A]: [access('11', 2), access('12', 3)],
  [BUSINESS_B]: [access('21', 4)],
};

/** Asset 5 lies on channel 3 (A's second store), asset 6 on channel 4 (B's store). */
const CHANNELS_OF_ASSET: ReadonlyMap<number, readonly number[]> = new Map([
  [ASSET_OF_A, [3]],
  [ASSET_OF_B, [4]],
]);

const assets: AssetAccessPort = {
  isAssetInChannels: () => Promise.reject(new Error('not used')),
  previewUrlInChannels: (_ctx, assetId, channelIds) =>
    Promise.resolve(
      (CHANNELS_OF_ASSET.get(assetId) ?? []).some((channelId) => channelIds.includes(channelId))
        ? `https://assets.test/preview/${String(assetId)}.png`
        : undefined,
    ),
};

const platform: Pick<PlatformStorePort, 'findStoreAccess'> = {
  findStoreAccess: (_ctx, businessId) => Promise.resolve(STORES[businessId] ?? []),
};

describe('LogoUrlService', () => {
  it("returns the url of the business's own logo, found on any of its stores' channels", async () => {
    // Arrange
    const service = new LogoUrlService({ platform, assets });

    // Act
    const url = await service.urlOf(ctx, BUSINESS_A, ASSET_OF_A);

    // Assert
    expect(url).toBe('https://assets.test/preview/5.png');
  });

  it('returns null for an asset of another business', async () => {
    // Arrange
    const service = new LogoUrlService({ platform, assets });

    // Act
    const url = await service.urlOf(ctx, BUSINESS_A, ASSET_OF_B);

    // Assert
    expect(url).toBeNull();
  });

  it('returns null without a logo, and for an asset that does not exist', async () => {
    // Arrange
    const service = new LogoUrlService({ platform, assets });

    // Act
    const none = await service.urlOf(ctx, BUSINESS_A, null);
    const missing = await service.urlOf(ctx, BUSINESS_A, 999);

    // Assert
    expect(none).toBeNull();
    expect(missing).toBeNull();
  });
});
