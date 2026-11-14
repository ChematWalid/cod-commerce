import { type ProductInput, productInputSchema, type Snowflake } from '@cod/shared';
import { type DemoProductSpec, demoProductsFor } from '../domain/demo-products';
import type { OperationContext } from '../domain/ports/operation-context';
import { isSkuTaken } from '../domain/sku';
import type { StoreScope } from '../domain/store-scope';
import { nameKeyOf } from '../domain/taxonomy';
import { BrandService } from './brand.service';
import type { ProductPorts } from './catalog-ports';
import { CreateProductService } from './create-product.service';
import { HighlightService } from './highlight.service';
import { TagService } from './tag.service';

/** The ids a demo product names, found or created in its store. */
interface DemoReferences {
  readonly brandId: Snowflake | null;
  readonly tagIds: readonly Snowflake[];
  readonly highlightIds: readonly Snowflake[];
}

/**
 * Gives a demo store its five synthetic products (D2129) through the same use cases a merchant's save runs, so the
 * seeded rows obey every catalog rule. A product whose SKU the store already holds is skipped, and a brand, tag or
 * highlight a previous run left behind is reused, so a second run creates nothing. Brands and tags are matched by name
 * key, as their unique index compares them, so a merchant's re-cased "demo brand" is reused rather than refused.
 */
export class DemoCatalogSeedService {
  private readonly creating: CreateProductService;
  private readonly brands: BrandService;
  private readonly tags: TagService;
  private readonly highlights: HighlightService;

  constructor(private readonly ports: ProductPorts) {
    this.creating = new CreateProductService(ports);
    this.brands = new BrandService(ports);
    this.tags = new TagService(ports);
    this.highlights = new HighlightService(ports);
  }

  /**
   * Seeds the store of `scope`, whose channel `ctx` runs in, with the demo products of `language`.
   *
   * @returns the SKUs of the products it created
   */
  async seedStore(ctx: OperationContext, scope: StoreScope, language: string): Promise<readonly string[]> {
    const created: string[] = [];
    for (const spec of demoProductsFor(language)) {
      if (await this.holdsSku(ctx, spec.sku)) continue;
      const references = await this.referencesOf(ctx, scope, spec);
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

  private async referencesOf(ctx: OperationContext, scope: StoreScope, spec: DemoProductSpec): Promise<DemoReferences> {
    const brandId = spec.brandName === null ? null : await this.brandIdOf(ctx, scope, spec.brandName);
    const tagIds: Snowflake[] = [];
    for (const name of spec.tagNames) tagIds.push(await this.tagIdOf(ctx, scope, name));
    const highlightIds: Snowflake[] = [];
    for (const text of spec.highlightTexts) highlightIds.push(await this.highlightIdOf(ctx, scope, text));
    return { brandId, tagIds, highlightIds };
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
    };
  }
}
