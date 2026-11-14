import { productInputSchema, type ProductInput, productPatchSchema, type SoldOutBehavior } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CatalogReadService, NoActiveStoreError } from '../../application/catalog-read.service';
import { InvalidCatalogInputError } from '../../domain/errors';
import type { PublicListContext, PublicVisibilityContext } from '../../domain/visibility';
import { CreateProductService } from '../../application/create-product.service';
import { UpdateProductService } from '../../application/update-product.service';
import { ProductWorld } from '../fakes/product-world';
import { scopeA, scopeB } from '../support/builders';

const PAGE = { skip: 0, take: 20 };

describe('CatalogReadService (AC2, AC6, D2109)', () => {
  let world: ProductWorld;
  let reads: CatalogReadService;
  const ctx = () => world.ctxOf(scopeA);

  beforeEach(() => {
    world = new ProductWorld();
    reads = new CatalogReadService(world.ports);
  });

  /** A product of store A with `input`, then its settings `settings` when given. */
  async function product(input: Partial<ProductInput>, settings?: Record<string, unknown>): Promise<string> {
    const { product: created } = await new CreateProductService(world.ports).create(
      ctx(),
      scopeA,
      productInputSchema.parse({ title: 'Lamp', status: 'active', price: 1500, ...input }),
    );
    if (settings !== undefined) {
      const patch = productPatchSchema.parse({ settings });
      await new UpdateProductService(world.ports).update(ctx(), scopeA, created.id, patch);
    }
    return created.id;
  }

  const open = (behavior: SoldOutBehavior): void => {
    world.openStore(scopeA, behavior);
  };
  const listedTitles = async () =>
    (await reads.listVisible(ctx(), 'listing', PAGE)).items.map((item) => item.title).sort();

  it('lists an active product and never a draft or a hidden one', async () => {
    // Arrange
    open('keep');
    await product({ title: 'Active' });
    await product({ title: 'Hidden', status: 'hidden' });
    await product({ title: 'Draft', status: 'draft' });

    // Act / Assert
    expect(await listedTitles()).toEqual(['Active']);
  });

  it('never returns a draft, not even by its slug on a landing page', async () => {
    // Arrange
    open('keep');
    await product({ title: 'Draft', slug: 'draft-lamp', status: 'draft' });

    // Act / Assert
    for (const context of ['listing', 'productPage', 'landingPage'] as const) {
      expect(await reads.findBySlug(ctx(), 'draft-lamp', context)).toBeUndefined();
    }
  });

  it('finds a hidden product by its slug only for a landing page', async () => {
    // Arrange
    open('keep');
    await product({ title: 'Hidden', slug: 'hidden-lamp', status: 'hidden' });

    // Act
    const onProductPage = await reads.findBySlug(ctx(), 'hidden-lamp', 'productPage');
    const onLandingPage = await reads.findBySlug(ctx(), 'hidden-lamp', 'landingPage');

    // Assert
    expect(onProductPage).toBeUndefined();
    expect(onLandingPage).toMatchObject({ title: 'Hidden', soldOut: false, orderable: true });
  });

  it('hide removes a sold-out product from the listing and its product page, but not its landing page', async () => {
    // Arrange
    open('hide');
    await product({ title: 'In stock' });
    await product({ title: 'Sold out', slug: 'sold-out-lamp' }, { soldOut: true });

    // Act
    const page = await reads.listVisible(ctx(), 'listing', PAGE);

    // Assert
    expect(page.items.map((item) => item.title)).toEqual(['In stock']);
    expect(page.totalItems).toBe(1);
    expect(await reads.findBySlug(ctx(), 'sold-out-lamp', 'productPage')).toBeUndefined();
    expect(await reads.findBySlug(ctx(), 'sold-out-lamp', 'landingPage')).toMatchObject({ soldOut: true });
  });

  it('keep shows a sold-out product flagged sold out, orderable until orders stop', async () => {
    // Arrange
    open('keep');
    await product({ title: 'Kept' }, { soldOut: true });
    await product({ title: 'Stopped' }, { soldOut: true, allowOutOfStockOrders: false });

    // Act
    const { items } = await reads.listVisible(ctx(), 'listing', PAGE);

    // Assert
    expect(items.map(({ title, soldOut, orderable }) => ({ title, soldOut, orderable }))).toEqual(
      expect.arrayContaining([
        { title: 'Kept', soldOut: true, orderable: true },
        { title: 'Stopped', soldOut: true, orderable: false },
      ]),
    );
  });

  it("never lists another business's product", async () => {
    // Arrange
    open('keep');
    world.openStore(scopeB, 'keep');
    await new CreateProductService(world.ports).create(
      world.ctxOf(scopeB),
      scopeB,
      productInputSchema.parse({ title: 'Foreign', status: 'active', price: 1 }),
    );

    // Act / Assert
    expect(await listedTitles()).toEqual([]);
  });

  it.each(['admin', 'landingPage', 'draft'])(
    'refuses to list for the %s context, so a forwarded value cannot widen the read',
    async (context) => {
      // Arrange
      open('keep');
      await product({ title: 'Draft', status: 'draft' });
      await product({ title: 'Hidden', status: 'hidden' });

      // Act
      const listing = reads.listVisible(ctx(), context as PublicListContext, PAGE);

      // Assert
      await expect(listing).rejects.toBeInstanceOf(InvalidCatalogInputError);
    },
  );

  it.each(['admin', 'storefront'])('refuses to find by slug for the %s context', async (context) => {
    // Arrange
    open('keep');
    await product({ title: 'Draft', slug: 'draft-lamp', status: 'draft' });

    // Act
    const finding = reads.findBySlug(ctx(), 'draft-lamp', context as PublicVisibilityContext);

    // Assert
    await expect(finding).rejects.toBeInstanceOf(InvalidCatalogInputError);
  });

  it('lists neither a draft nor a hidden product for any accepted list context', async () => {
    // Arrange
    open('keep');
    await product({ title: 'Active' });
    await product({ title: 'Hidden', status: 'hidden' });
    await product({ title: 'Draft', status: 'draft' });

    // Act
    const titles = await Promise.all(
      (['listing', 'productPage'] as const).map(async (context) =>
        (await reads.listVisible(ctx(), context, PAGE)).items.map((item) => item.title),
      ),
    );

    // Assert
    expect(titles).toEqual([['Active'], ['Active']]);
  });

  it('refuses a context without an active store (D2142)', async () => {
    // Arrange: no store is open for this context

    // Act
    const listing = reads.listVisible(ctx(), 'listing', PAGE);
    const finding = reads.findBySlug(ctx(), 'any', 'landingPage');

    // Assert
    await expect(listing).rejects.toBeInstanceOf(NoActiveStoreError);
    await expect(finding).rejects.toBeInstanceOf(NoActiveStoreError);
  });
});
