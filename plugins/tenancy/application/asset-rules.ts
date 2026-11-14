import { AssetNotAvailableError } from '../domain/errors';
import type { AssetAccessPort } from '../domain/ports/asset-access.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreAccess } from '../domain/store';

/** The channels of a business's stores. */
export const channelsOf = (stores: readonly StoreAccess[]): readonly number[] => stores.map((store) => store.channelId);

/**
 * Checks an asset before it becomes a logo, which the storefront publishes without further checks.
 *
 * @throws {@link AssetNotAvailableError} when no listed channel holds it
 */
export async function assertAssetInChannels(
  assets: AssetAccessPort,
  ctx: OperationContext,
  assetId: number,
  channelIds: readonly number[],
): Promise<void> {
  if (!(await assets.isAssetInChannels(ctx, assetId, channelIds))) {
    throw new AssetNotAvailableError();
  }
}

/** The URL a logo is shown from, or `null` when no listed channel holds the asset. */
export async function logoUrlInChannels(
  assets: AssetAccessPort,
  ctx: OperationContext,
  assetId: number,
  channelIds: readonly number[],
): Promise<string | null> {
  return (await assets.previewUrlInChannels(ctx, assetId, channelIds)) ?? null;
}
