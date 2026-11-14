import type { BusinessId } from '@cod/shared';
import type { AssetAccessPort } from '../domain/ports/asset-access.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { PlatformStorePort } from '../domain/ports/platform-store.port';
import type { Store } from '../domain/store';
import { channelsOf, logoUrlInChannels } from './asset-rules';

/** What the logo URL is read through: the business's stores and the engine's assets. */
export interface LogoUrlPorts {
  readonly platform: Pick<PlatformStorePort, 'findStoreAccess'>;
  readonly assets: AssetAccessPort;
}

/** What a store's logo is read from: the store's own channel and the saved asset id. */
export type StoreLogo = Pick<Store, 'channelId' | 'logoAssetId'>;

/**
 * The URL a business's or a store's logo is shown from (D2120, #178). Each read follows the matching write rule:
 * `updateBusiness` accepts an asset on any of the business's store channels, `updateStore` only one on the store's
 * own channel.
 */
export class LogoUrlService {
  constructor(private readonly ports: LogoUrlPorts) {}

  /**
   * The preview URL of `logoAssetId` when one of the business's store channels holds it, else `null`. A saved id is
   * checked again on every read, so a row naming another business's asset never yields that asset's URL.
   */
  async urlOf(ctx: OperationContext, businessId: BusinessId, logoAssetId: number | null): Promise<string | null> {
    if (logoAssetId === null) return null;
    const stores = await this.ports.platform.findStoreAccess(ctx, businessId);
    return logoUrlInChannels(this.ports.assets, ctx, logoAssetId, channelsOf(stores));
  }

  /**
   * The preview URL of a store's logo when the store's own channel holds it, else `null`. One lookup per store, so a
   * list of stores costs one asset read each rather than one per store of the business.
   */
  async storeUrlOf(ctx: OperationContext, { channelId, logoAssetId }: StoreLogo): Promise<string | null> {
    if (logoAssetId === null) return null;
    return logoUrlInChannels(this.ports.assets, ctx, logoAssetId, [channelId]);
  }
}
