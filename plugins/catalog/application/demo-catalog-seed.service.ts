import { type ProductInput, productInputSchema, type Snowflake } from '@cod/shared';
import { type DemoCollectionKey, type DemoProductSpec, demoProductsFor } from '../domain/demo-products';
import { InvalidCatalogInputError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import { isSkuTaken } from '../domain/sku';
import type { StoreScope } from '../domain/store-scope';
import { nameKeyOf } from '../domain/taxonomy';
import { BrandService } from './brand.service';
import type { ProductPorts } from './catalog-ports';
import { CreateProductService } from './create-product.service';
import { HighlightService } from './highlight.service';
import { MediaLibraryService } from './media-library.service';
import { TagService } from './tag.service';

/**
 * What the caller adds to a demo seed: the bytes of a product's synthetic image, made from its colour, and the id of
 * each demo collection it made in the store (collections belong to the collections plugin, P3.S2). A product without
 * an image source or a resolved collection is created without them.
 */
export interface DemoSeedExtras {
  readonly imageOf?: (color: string) => Uint8Array;
  readonly collectionIdOf?: (key: DemoCollectionKey) => string | undefined;
}

/** The ids a demo product names, found or created in its store. */
interface DemoReferences {
  readonly brandId: Snowflake | null;
  readonly tagIds: readonly Snowflake[];
  readonly highlightIds: readonly Snowflake[];
  readonly assetId: string | null;
  readonly collectionIds: readonly string[];
}

/**
 * Gives a demo store its ten synthetic products (D2129, P3.S2), with their images and demo collections when the caller
 * supplies them, through the same use cases a merchant's save runs, so the
 * seeded rows obey every catalog rule. A product whose SKU the store already holds is skipped, and a brand, tag or
 * highlight a previous run left behind is reused, so a second run creates nothing. Brands and tags are matched by name
 * key, as their unique index compares them, so a merchant's re-cased "demo brand" is reused rather than refused.
 */
export class DemoCatalogSeedService {
  private readonly creating: CreateProductService;
  private readonly brands: BrandService;
  private readonly tags: TagService;
  private readonly highlights: HighlightService;
  private readonly media: MediaLibraryService;

  constructor(private readonly ports: ProductPorts) {
    this.creating = new CreateProductService(ports);
    this.brands = new BrandService(ports);
    this.tags = new TagService(ports);
    this.highlights = new HighlightService(ports);
    this.media = new MediaLibraryService(ports);
  }

  /**
   * Seeds the store of `scope`, whose channel `ctx` runs in, with the demo products of `language`. An image is uploaded
   * to the store's media library only for a product the run creates.
   *
   * @returns the SKUs of the products it created
   * @throws {@link InvalidCatalogInputError} when `scope` is not the store of `ctx`'s channel: products follow the
   * channel and their links the scope, so a mismatch would split each product across two stores (D2142).
   */
  async seedStore(
    ctx: OperationContext,
    scope: StoreScope,
    language: string,
    extras: DemoSeedExtras = {},
  ): Promise<readonly string[]> {
    if (!(await this.ports.stores.isChannelOf(ctx, scope))) throw new InvalidCatalogInputError();
    const created: string[] = [];
    for (const spec of demoProductsFor(language)) {
      if (await this.holdsSku(ctx, spec.sku)) continue;
      const references = await this.referencesOf(ctx, scope, spec, extras);
      await this.creating.create(ctx, scope, productInputSchema.parse(this.inputOf(spec, references)));
      created.push(spec.sku);
    }
    return created;
  }

  private async holdsSku(ctx: OperationContext, sku: string): Promise<boolean> {
    const ids = await this.ports.search.matchingProductIds(ctx, sku);
    const records = await Promise.all(ids.map((id) => this.ports.products.findOne(ctx, id)));
    const skus = records.flatMap((record) => (record?.sku === undefined || record.sku === null ? [] : [record.sku]));
    return isSkuTaken(sku, skus);
  }

  private async referencesOf(
    ctx: OperationContext,
    scope: StoreScope,
    spec: DemoProductSpec,
    extras: DemoSeedExtras,
  ): Promise<DemoReferences> {
    const brandId = spec.brandName === null ? null : await this.brandIdOf(ctx, scope, spec.brandName);
    const tagIds: Snowflake[] = [];
    for (const name of spec.tagNames) tagIds.push(await this.tagIdOf(ctx, scope, name));
    const highlightIds: Snowflake[] = [];
    for (const text of spec.highlightTexts) highlightIds.push(await this.highlightIdOf(ctx, scope, text));
    const assetId = await this.imageIdOf(ctx, scope, spec.imageColor, extras.imageOf);
    const collectionIds = spec.collectionKeys.flatMap((key) => extras.collectionIdOf?.(key) ?? []);
    return { brandId, tagIds, highlightIds, assetId, collectionIds };
  }

  private async imageIdOf(
    ctx: OperationContext,
    scope: StoreScope,
    color: string | null,
    imageOf: DemoSeedExtras['imageOf'],
  ): Promise<string | null> {
    if (color === null || imageOf === undefined) return null;
    return (await this.media.upload(ctx, scope, imageOf(color))).assetId;
  }

  private async brandIdOf(ctx: OperationContext, scope: StoreScope, name: string): Promise<Snowflake> {
    const existing = (await this.brands.list(ctx, scope)).find((brand) => brand.nameKey === nameKeyOf(name));
    return (existing ?? (await this.brands.create(ctx, scope, { name }))).id;
  }

  private async tagIdOf(ctx: OperationContext, scope: StoreScope, name: string): Promise<Snowflake> {
    const existing = (await this.tags.list(ctx, scope)).find((tag) => tag.nameKey === nameKeyOf(name));
    return (existing ?? (await this.tags.create(ctx, scope, { name }))).id;
  }

  private async highlightIdOf(ctx: OperationContext, scope: StoreScope, text: string): Promise<Snowflake> {
    const existing = (await this.highlights.list(ctx, scope)).find((highlight) => highlight.text === text);
    return (existing ?? (await this.highlights.create(ctx, scope, { text }))).id;
  }

  private inputOf(spec: DemoProductSpec, references: DemoReferences): ProductInput {
    return {
      title: spec.title,
      status: spec.status,
      price: spec.price,
      oldPrice: spec.oldPrice,
      sku: spec.sku,
      optionGroups: spec.optionGroups.map((group) => ({ name: group.name, values: [...group.values] })),
      brandId: references.brandId,
      tagIds: [...references.tagIds],
      highlightIds: [...references.highlightIds],
      featuredAssetId: references.assetId,
      assetIds: references.assetId === null ? [] : [references.assetId],
      collectionIds: [...references.collectionIds],
    };
  }
}
