import { isSnowflake, type Snowflake } from '@cod/shared';
import { type CoreId, isCoreId, parseCoreId } from '../domain/core-id';
import {
  BrandNotFoundError,
  CollectionNotFoundError,
  HighlightNotFoundError,
  MediaNotFoundError,
  OrderManagerUnknownError,
  TagNotFoundError,
} from '../domain/errors';
import { assertHighlightCount } from '../domain/highlights';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProductRecord } from '../domain/product';
import type { StoreScope } from '../domain/store-scope';
import type { ProductPorts } from './catalog-ports';
import { mediaReachOf } from './media-reach';
import { checkOrderManagers } from './product-settings.service';

/** The ids a product body names, as sent; `undefined` means "not sent", `null` clears a single id. */
export interface ReferenceInput {
  readonly brandId?: string | null;
  readonly tagIds?: readonly string[];
  readonly highlightIds?: readonly string[];
  readonly collectionIds?: readonly string[];
  readonly featuredAssetId?: string | null;
  readonly assetIds?: readonly string[];
  /** Featured images of edited variants; checked like product images. */
  readonly variantAssetIds?: readonly string[];
  /** The order managers the settings name; team's check must accept each for the store (D2114). */
  readonly orderManagerIds?: readonly string[];
}

/** The same ids once each is known to belong to the caller's store (D2134, D2135); `undefined` stays "not sent". */
export interface CheckedReferences {
  readonly brandId?: Snowflake | null;
  readonly tagIds?: readonly Snowflake[];
  readonly highlightIds?: readonly Snowflake[];
  readonly collectionIds?: readonly CoreId[];
  readonly featuredAssetId?: CoreId | null;
  readonly assetIds?: readonly CoreId[];
}

type NotFound = new () => Error;

/** Parses snowflake ids; a malformed one answers not found, like a foreign one (D2136). */
function snowflakesOf(ids: readonly string[], notFound: NotFound): Snowflake[] {
  return ids.map((id) => {
    if (!isSnowflake(id)) throw new notFound();
    return id;
  });
}

/** Parses Vendure ids; a malformed one answers not found (D2136). */
export function coreIdsOf(ids: readonly string[], notFound: NotFound): CoreId[] {
  return ids.map((id) => {
    const parsed = parseCoreId(id);
    if (parsed === undefined) throw new notFound();
    return parsed;
  });
}

/** Every image id a product body names, as sent: featured, gallery and variant images. */
function namedImageIds(input: ReferenceInput): string[] {
  const featured = input.featuredAssetId;
  const named = [...(featured === undefined || featured === null ? [] : [featured]), ...(input.assetIds ?? [])];
  return [...named, ...(input.variantAssetIds ?? [])];
}

/** Every image id a product body names, parsed; a malformed one answers not found. */
const imageIdsOf = (input: ReferenceInput): CoreId[] => coreIdsOf(namedImageIds(input), MediaNotFoundError);

/** No image is held yet: what a new product starts from. */
const NO_HELD_IMAGES: ReadonlySet<string> = new Set();

/** The images `record` already shows: featured, gallery and variant images. */
export function heldImagesOf(record: ProductRecord): ReadonlySet<string> {
  const variantImages = record.variants.flatMap((variant) =>
    variant.featuredAssetId === null ? [] : [variant.featuredAssetId],
  );
  const featured = record.featuredAssetId === null ? [] : [record.featuredAssetId];
  return new Set<string>([...featured, ...record.assetIds, ...variantImages]);
}

/** True when every id of `wanted` is among `found`. */
const allFound = (wanted: readonly string[], found: readonly string[]): boolean => {
  const present = new Set(found);
  return wanted.every((id) => present.has(id));
};

/**
 * Checks that every id a product body names is the caller's: brands, tags and highlights of the active store,
 * collections of its channel, images of the media of the stores the caller reaches (D2132), order managers team's
 * check accepts for the store (D2114). Another business's id, the
 * business's other store's id and a malformed id all answer "not found" with the entity's code; nothing is written
 * before every id passed.
 */
export class ProductReferenceCheck {
  constructor(private readonly ports: ProductPorts) {}

  /**
   * Takes the shared taxonomy lock of every well-formed brand, tag and highlight id `input` names, then the shared
   * media lock of every well-formed image id, so none of them is deleted before the save commits (D2128). Run it
   * inside the save's transaction, before its product lock and before {@link check}.
   */
  async lockNamed(ctx: OperationContext, input: ReferenceInput): Promise<void> {
    const named = [...(input.brandId ? [input.brandId] : []), ...(input.tagIds ?? []), ...(input.highlightIds ?? [])];
    await this.ports.taxonomyLock.share(ctx, named.filter(isSnowflake));
    const images = namedImageIds(input).filter(isCoreId);
    if (images.length > 0) await this.ports.mediaLock.share(ctx, images);
  }

  /**
   * `held` are the images the product already shows (an update's {@link heldImagesOf}): they were checked when they
   * were attached, so a member whose reach is narrower than the one who attached them may still send them back; only
   * newly named images are checked against the caller's reach (D2132).
   */
  async check(
    ctx: OperationContext,
    scope: StoreScope,
    input: ReferenceInput,
    held: ReadonlySet<string> = NO_HELD_IMAGES,
  ): Promise<CheckedReferences> {
    const [brandId, tagIds, highlightIds, collectionIds, assets] = await Promise.all([
      this.brand(ctx, scope, input.brandId),
      this.tags(ctx, scope, input.tagIds),
      this.highlights(ctx, scope, input.highlightIds),
      this.collections(ctx, input.collectionIds),
      this.assets(ctx, scope, input, held),
      checkOrderManagers(this.ports, ctx, scope, snowflakesOf(input.orderManagerIds ?? [], OrderManagerUnknownError)),
    ]);
    return { brandId, tagIds, highlightIds, collectionIds, ...assets };
  }

  private async brand(ctx: OperationContext, scope: StoreScope, id: string | null | undefined) {
    if (id === undefined || id === null) return id;
    const [brandId] = snowflakesOf([id], BrandNotFoundError);
    if (brandId === undefined || (await this.ports.brands.findById(ctx, scope, brandId)) === undefined) {
      throw new BrandNotFoundError();
    }
    return brandId;
  }

  private async tags(ctx: OperationContext, scope: StoreScope, ids: readonly string[] | undefined) {
    if (ids === undefined) return undefined;
    const tagIds = snowflakesOf(ids, TagNotFoundError);
    const found = tagIds.length === 0 ? [] : await this.ports.tags.findByIds(ctx, scope, tagIds);
    if (
      !allFound(
        tagIds,
        found.map((tag) => tag.id),
      )
    )
      throw new TagNotFoundError();
    return tagIds;
  }

  private async highlights(ctx: OperationContext, scope: StoreScope, ids: readonly string[] | undefined) {
    if (ids === undefined) return undefined;
    assertHighlightCount(ids);
    const highlightIds = snowflakesOf(ids, HighlightNotFoundError);
    const found = highlightIds.length === 0 ? [] : await this.ports.highlights.findByIds(ctx, scope, highlightIds);
    if (
      !allFound(
        highlightIds,
        found.map((highlight) => highlight.id),
      )
    )
      throw new HighlightNotFoundError();
    return highlightIds;
  }

  private async collections(ctx: OperationContext, ids: readonly string[] | undefined) {
    if (ids === undefined) return undefined;
    const collectionIds = coreIdsOf(ids, CollectionNotFoundError);
    const found = collectionIds.length === 0 ? [] : await this.ports.products.existingCollections(ctx, collectionIds);
    if (!allFound(collectionIds, found)) throw new CollectionNotFoundError();
    return collectionIds;
  }

  /**
   * Makes every image `input` names usable in the store channel of `ctx` (D2113): a media item of the business's other
   * store is in that store's channel only. Run it after {@link check}, in the same transaction.
   */
  async shareImages(ctx: OperationContext, input: ReferenceInput): Promise<void> {
    const ids = [...new Set(imageIdsOf(input))];
    if (ids.length > 0) await this.ports.storage.shareWithStore(ctx, ids);
  }

  private async assets(
    ctx: OperationContext,
    scope: StoreScope,
    input: ReferenceInput,
    held: ReadonlySet<string>,
  ): Promise<Pick<CheckedReferences, 'featuredAssetId' | 'assetIds'>> {
    const featured = input.featuredAssetId;
    const ids = imageIdsOf(input).filter((id) => !held.has(id));
    if (ids.length > 0) {
      const reach = await mediaReachOf(this.ports.orderManagers, ctx, scope);
      const items = await this.ports.media.findByAssetIds(ctx, scope, reach, ids);
      if (
        !allFound(
          ids,
          items.map((item) => item.assetId),
        )
      )
        throw new MediaNotFoundError();
    }
    return {
      featuredAssetId:
        featured === undefined || featured === null ? featured : coreIdsOf([featured], MediaNotFoundError)[0],
      assetIds: input.assetIds === undefined ? undefined : coreIdsOf(input.assetIds, MediaNotFoundError),
    };
  }
}
