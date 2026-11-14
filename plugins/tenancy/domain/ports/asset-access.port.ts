import type { OperationContext } from './operation-context';

/** The commerce engine's asset library, as seen from a tenant's channels. */
export interface AssetAccessPort {
  /** True when the asset exists on at least one of the channels. */
  isAssetInChannels(ctx: OperationContext, assetId: number, channelIds: readonly number[]): Promise<boolean>;

  /**
   * The absolute URL of the asset's preview image when at least one of the channels holds the asset, otherwise
   * `undefined`: an asset outside them is never described, so its URL cannot leak to another business.
   */
  previewUrlInChannels(
    ctx: OperationContext,
    assetId: number,
    channelIds: readonly number[],
  ): Promise<string | undefined>;
}
