import type { OperationContext } from './operation-context';

/** The commerce engine's asset library, as seen from a tenant's channels. */
export interface AssetAccessPort {
  /** True when the asset exists on at least one of the channels. */
  isAssetInChannels(ctx: OperationContext, assetId: number, channelIds: readonly number[]): Promise<boolean>;
}
