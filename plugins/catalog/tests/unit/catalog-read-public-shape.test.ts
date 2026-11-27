import { productInputSchema, type ProductInput, productPatchSchema } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CatalogReadService } from '../../application/catalog-read.service';
import { CreateProductService } from '../../application/create-product.service';
import { UpdateProductService } from '../../application/update-product.service';
import { type CoreId, toCoreId } from '../../domain/core-id';
import { ProductWorld } from '../fakes/product-world';
import { mediaOf, scopeA } from '../support/builders';

const PAGE = { skip: 0, take: 20 };

describe('CatalogReadService public shape (#246, P3.S2 image previews)', () => {
  let world: ProductWorld;
  let reads: CatalogReadService;
  const ctx = () => world.ctxOf(scopeA);

  beforeEach(() => {
    world = new ProductWorld();
    reads = new CatalogReadService(world.ports);
    world.openStore(scopeA, 'keep');
  });

  async function product(input: Partial<ProductInput>): Promise<string> {
    const { product: created } = await new CreateProductService(world.ports).create(
      ctx(),
      scopeA,
      productInputSchema.parse({ title: 'Shirt', status: 'active', price: 1500, ...input }),
    );
    return created.id;
  }

  /** Hides every variant of `productId` whose option values `hide` picks. */
  async function hideVariants(productId: string, hide: (values: readonly string[]) => boolean): Promise<void> {
    const record = await world.ports.products.findOne(ctx(), toCoreId(productId));
    const variants = (record?.variants ?? [])
      .filter((variant) => hide(variant.optionValues))
      .map((variant) => ({ id: variant.id, isHidden: true }));
    await new UpdateProductService(world.ports).update(
      ctx(),
      scopeA,
      productId,
      productPatchSchema.parse({ variants }),
    );
  }

  /** An image of store A's media library, with a preview path in the storage. */
  async function image(): Promise<CoreId> {
    const media = mediaOf(scopeA);
    await world.media.insert(ctx(), scopeA, media);
    world.storage.previews.set(media.assetId, `preview/${media.assetId}.webp`);
    return media.assetId;
  }

  const valuesOf = (groups: readonly { name: string; values: readonly { name: string }[] }[]) =>
    groups.map((group) => ({ name: group.name, values: group.values.map((value) => value.name) }));

  it('drops an option value whose every variant is hidden, keeping the order of the others', async () => {
    // Arrange
    const id = await product({
      slug: 'shirt',
      sku: 'SH',
      optionGroups: [
        { name: 'Color', values: ['Red', 'Green', 'Blue'] },
        { name: 'Size', values: ['S', 'M'] },
      ],
    });
    await hideVariants(id, (values) => values[0] === 'Green');

    // Act
    const found = await reads.findBySlug(ctx(), 'shirt', 'productPage');
    const [listed] = (await reads.listVisible(ctx(), 'listing', PAGE)).items;

    // Assert
    const expected = [
      { name: 'Color', values: ['Red', 'Blue'] },
      { name: 'Size', values: ['S', 'M'] },
    ];
    expect(valuesOf(found?.optionGroups ?? [])).toEqual(expected);
    expect(valuesOf(listed?.optionGroups ?? [])).toEqual(expected);
  });

  it('keeps a value shared by another group apart: hiding Size S leaves Color untouched', async () => {
    // Arrange
    const id = await product({
      slug: 'shirt',
      sku: 'SH',
      optionGroups: [
        { name: 'Color', values: ['Red', 'Blue'] },
        { name: 'Size', values: ['S', 'M'] },
      ],
    });
    await hideVariants(id, (values) => values[1] === 'S');

    // Act
    const found = await reads.findBySlug(ctx(), 'shirt', 'productPage');

    // Assert
    expect(valuesOf(found?.optionGroups ?? [])).toEqual([
      { name: 'Color', values: ['Red', 'Blue'] },
      { name: 'Size', values: ['M'] },
    ]);
  });

  it('drops a group left with no values', async () => {
    // Arrange
    const id = await product({ slug: 'shirt', sku: 'SH', optionGroups: [{ name: 'Color', values: ['Red'] }] });
    await hideVariants(id, () => true);

    // Act
    const found = await reads.findBySlug(ctx(), 'shirt', 'landingPage');

    // Assert
    expect(found?.optionGroups).toEqual([]);
  });

  it('carries the preview path of the featured image, the gallery and each variant image', async () => {
    // Arrange
    const [featured, gallery] = [await image(), await image()];
    const id = await product({ slug: 'lamp', featuredAssetId: featured, assetIds: [featured, gallery] });
    const record = await world.ports.products.findOne(ctx(), toCoreId(id));
    const variantId = record?.variants[0]?.id;
    const patch = productPatchSchema.parse({ variants: [{ id: variantId, featuredAssetId: gallery }] });
    await new UpdateProductService(world.ports).update(ctx(), scopeA, id, patch);

    // Act
    const found = await reads.findBySlug(ctx(), 'lamp', 'productPage');

    // Assert
    expect(found?.featuredAssetId).toBe(featured);
    expect(found?.featuredAsset).toEqual({ id: featured, preview: `preview/${featured}.webp` });
    expect(found?.assets).toEqual([
      { id: featured, preview: `preview/${featured}.webp` },
      { id: gallery, preview: `preview/${gallery}.webp` },
    ]);
    expect(found?.variants[0]?.featuredAssetPreview).toBe(`preview/${gallery}.webp`);
  });

  it('a product without images, or whose image is gone from the storage, carries no preview', async () => {
    // Arrange
    const gone = await image();
    world.storage.previews.delete(gone);
    await product({ slug: 'bare' });
    await product({ slug: 'gone', featuredAssetId: gone, assetIds: [gone] });

    // Act
    const [bare, lost] = await Promise.all(
      ['bare', 'gone'].map((slug) => reads.findBySlug(ctx(), slug, 'productPage')),
    );

    // Assert
    expect(bare).toMatchObject({ featuredAsset: null, assets: [] });
    expect(bare?.variants[0]?.featuredAssetPreview).toBeNull();
    expect(lost).toMatchObject({ featuredAsset: null, assets: [] });
  });

  it('reads the previews of a whole page in one call', async () => {
    // Arrange
    const [first, second] = [await image(), await image()];
    await product({ title: 'One', featuredAssetId: first });
    await product({ title: 'Two', featuredAssetId: second });
    world.storage.previewCalls.length = 0;

    // Act
    const page = await reads.listVisible(ctx(), 'listing', PAGE);

    // Assert
    expect(page.items.map((item) => item.featuredAsset?.preview).sort()).toEqual(
      [`preview/${first}.webp`, `preview/${second}.webp`].sort(),
    );
    expect(world.storage.previewCalls).toHaveLength(1);
    expect([...(world.storage.previewCalls[0] ?? [])].sort()).toEqual([first, second].sort());
  });
});
