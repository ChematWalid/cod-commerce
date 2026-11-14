import { MAX_PRODUCT_ASSETS } from '@cod/shared';

/** The images of a product as the editor holds them: library assets in order, and the one shown first. */
export interface ImagesDraft {
  readonly assetIds: readonly string[];
  readonly featuredAssetId: string | null;
}

/**
 * The product's images become `assetIds` (at most twenty, D2141). The featured image stays if it is still among them,
 * otherwise the first one is featured.
 */
export function withImages(draft: ImagesDraft, assetIds: readonly string[]): ImagesDraft {
  const kept = [...new Set(assetIds)].slice(0, MAX_PRODUCT_ASSETS);
  const featured =
    draft.featuredAssetId !== null && kept.includes(draft.featuredAssetId) ? draft.featuredAssetId : null;
  return { assetIds: kept, featuredAssetId: featured ?? kept[0] ?? null };
}

export const withoutImage = (draft: ImagesDraft, assetId: string): ImagesDraft =>
  withImages(
    draft,
    draft.assetIds.filter((id) => id !== assetId),
  );
