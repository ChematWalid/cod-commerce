import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { RateLimiter } from '@cod/plugin-rate-limit';
import { CATALOG_PACKS_ERROR_CODES as P } from '@cod/shared';
import { failureOf, rawTestId } from '@cod/testing';
import { beforeAll, describe, expect, it } from 'vitest';
import { PACK, type PackResult, packInput, packsSuite, PREVIEW_PACK, type ProductResult, SAVE_PACK } from './packs-kit';

const suite = packsSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const PREVIEW_BUDGET = 600;

interface Arranged {
  shirt: ProductResult;
  trousers: ProductResult;
  pack: ProductResult;
}

/** As A's owner: components priced 1 500 (300 g) and 2 000 (500 g), and a bare pack product. */
async function arrange(): Promise<Arranged> {
  await suite.kit.asOwner(suite.fixtures.a);
  const shirt = await suite.kit.createProduct({ title: 'Shirt', price: 1500, weight: 300 });
  const trousers = await suite.kit.createProduct({ title: 'Trousers', price: 2000, weight: 500 });
  const pack = await suite.kit.createPackProduct();
  return { shirt, trousers, pack };
}

async function save(productId: string, input: Record<string, unknown>): Promise<PackResult> {
  const { saveCatalogPack } = await suite.kit.gql<{ saveCatalogPack: PackResult }>(SAVE_PACK, { id: productId, input });
  return saveCatalogPack;
}

describe('pack save, read and preview (AC1)', () => {
  let world: Arranged;

  beforeAll(async () => {
    world = await arrange();
  });

  it('saves a 2-component 10 % pack and stores 3 150 on its variant', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const saved = await save(world.pack.id, packInput([world.shirt.id, world.trousers.id]));
    const product = await suite.kit.product(world.pack.id);

    // Assert
    expect(saved).toMatchObject({ productId: world.pack.id, status: 'ok', price: 3150 });
    expect(product?.variants.map((variant) => variant.price)).toEqual([3150]);
  });

  it('components_sum weight stored on the pack product (1 100 g)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const input = packInput([], {
      components: [
        { productId: world.shirt.id, quantity: 2 },
        { productId: world.trousers.id, quantity: 1 },
      ],
    });

    // Act
    await save(world.pack.id, input);

    // Assert
    expect((await suite.kit.product(world.pack.id))?.weight).toBe(1100);
  });

  it('fixed weight stored', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const input = packInput([world.shirt.id, world.trousers.id], {
      packWeightMode: 'fixed',
      packFixedWeightGrams: 750,
    });

    // Act
    const saved = await save(world.pack.id, input);

    // Assert
    expect(saved.weightGrams).toBe(750);
    expect((await suite.kit.product(world.pack.id))?.weight).toBe(750);
  });

  it('per_component pack has one default variant and a pinned component variant drives its price', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const sized = await suite.kit.createProduct({
      title: 'Sized shirt',
      price: 1000,
      optionGroups: [{ name: 'Size', values: ['M', 'L'] }],
    });
    const large = sized.variants.find((variant) => variant.optionValues[0] === 'L');
    await suite.kit.gql(
      'mutation ($id: ID!, $input: UpdateCatalogProductInput!) { updateCatalogProduct(id: $id, input: $input) { product { id } } }',
      {
        id: sized.id,
        input: { variants: [{ id: large?.id, price: 1200 }] },
      },
    );
    const input = packInput([], {
      packDiscountType: null,
      packDiscountValue: null,
      components: [
        { productId: sized.id, variantId: large?.id, quantity: 1 },
        { productId: world.trousers.id, quantity: 1 },
      ],
    });

    // Act
    await save(world.pack.id, input);
    const product = await suite.kit.product(world.pack.id);

    // Assert
    expect(product?.optionGroups).toEqual([]);
    expect(product?.variants.map((variant) => variant.price)).toEqual([3200]);
  });

  it('shared option creates one pack variant per common value', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const top = await suite.kit.createProduct({
      title: 'Top',
      price: 1500,
      optionGroups: [{ name: 'Size', values: ['S', 'M', 'L'] }],
    });
    const bottom = await suite.kit.createProduct({
      title: 'Bottom',
      price: 2000,
      optionGroups: [{ name: 'size', values: ['M', 'L', 'XL'] }],
    });
    const input = packInput([top.id, bottom.id], { packVariantMode: 'shared_option', packSharedOption: 'Size' });

    // Act
    await save(world.pack.id, input);
    const product = await suite.kit.product(world.pack.id);

    // Assert
    expect(product?.optionGroups.map((group) => group.values.map((value) => value.name))).toEqual([['M', 'L']]);
    expect(product?.variants.map((variant) => [variant.optionValues, variant.price])).toEqual([
      [['M'], 3150],
      [['L'], 3150],
    ]);
  });

  it('reads the saved pack back', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    await save(world.pack.id, packInput([world.shirt.id, world.trousers.id]));

    // Act
    const { catalogPack } = await suite.kit.gql<{ catalogPack: PackResult | null }>(PACK, { id: world.pack.id });
    const rest = await suite.kit.rest('GET', `/catalog/packs/${rawTestId(world.pack.id)}`);

    // Assert
    expect(catalogPack?.components.map((line) => line.productId)).toEqual([world.shirt.id, world.trousers.id]);
    expect(rest).toMatchObject({ status: 200, body: { price: 3150, status: 'ok' } });
  });

  it('preview computes without saving', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const before = await suite.kit.product(world.pack.id);
    const input = packInput([world.shirt.id, world.trousers.id], { packDiscountValue: 50 });

    // Act
    const { previewCatalogPack } = await suite.kit.gql<{ previewCatalogPack: { price: number } }>(PREVIEW_PACK, {
      input,
    });

    // Assert
    expect(previewCatalogPack.price).toBe(1750);
    expect(await suite.kit.product(world.pack.id)).toEqual(before);
  });

  it('refuses a product that is not a pack', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const failure = await failureOf(
      suite.kit.gql(SAVE_PACK, { id: world.shirt.id, input: packInput([world.trousers.id, world.pack.id]) }),
    );

    // Assert
    expect(failure.codes).toEqual([P.NOT_A_PACK]);
  });
});

describe('pack refusals across businesses and products', () => {
  let world: Arranged;
  let foreign: ProductResult;

  beforeAll(async () => {
    world = await arrange();
    await suite.kit.asOwner(suite.fixtures.b);
    foreign = await suite.kit.createProduct({ title: 'B only', price: 999 });
  });

  it('refuses a component of business B as not found', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const failure = await failureOf(save(world.pack.id, packInput([world.shirt.id, foreign.id])));

    // Assert
    expect(failure.codes).toEqual([P.COMPONENT_NOT_FOUND]);
    expect((await suite.kit.product(world.pack.id))?.price).toBe(0);
  });

  it("preview with B's component id → not found, no price in the body", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const answer = await suite.kit.rest(
      'POST',
      '/catalog/packs/preview',
      packInput([rawTestId(world.shirt.id), rawTestId(foreign.id)]),
    );

    // Assert
    expect(answer.status).toBe(404);
    expect(answer.body).toMatchObject({ code: P.COMPONENT_NOT_FOUND });
    expect(answer.text).not.toContain('999');
  });

  it('save and preview with a variantId of another product → not found', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const input = packInput([], {
      components: [
        { productId: world.shirt.id, variantId: world.trousers.variants[0]?.id, quantity: 1 },
        { productId: world.trousers.id, quantity: 1 },
      ],
    });

    // Act
    const saving = await failureOf(save(world.pack.id, input));
    const previewing = await failureOf(suite.kit.gql(PREVIEW_PACK, { input }));

    // Assert
    expect(saving.codes).toEqual([P.COMPONENT_NOT_FOUND]);
    expect(previewing.codes).toEqual([P.COMPONENT_NOT_FOUND]);
  });

  it('edit needed to save and preview, view to read (FORBIDDEN)', async () => {
    // Arrange
    await suite.kit.signInAsMember(suite.fixtures.a, ['catalog.products.view']);
    const input = packInput([world.shirt.id, world.trousers.id]);

    // Act
    const reading = await suite.kit.gql<{ catalogPack: unknown }>(PACK, { id: world.pack.id });
    const saving = await failureOf(save(world.pack.id, input));
    const previewing = await failureOf(suite.kit.gql(PREVIEW_PACK, { input }));
    await suite.kit.signInAsMember(suite.fixtures.a, ['catalog.products.edit']);
    const readingWithoutView = await failureOf(suite.kit.gql(PACK, { id: world.pack.id }));

    // Assert
    expect(reading).toHaveProperty('catalogPack');
    expect(saving.codes).toEqual(['FORBIDDEN']);
    expect(previewing.codes).toEqual(['FORBIDDEN']);
    expect(readingWithoutView.codes).toEqual(['FORBIDDEN']);
  });

  it('pack preview 429 after the actor budget, with Retry-After', async () => {
    // Arrange: a member of its own, its budget spent to the last call
    const member = await suite.kit.signInAsMember(suite.fixtures.a, ['catalog.products.edit']);
    const [user] = await suite.kit.query<{ id: number }>('SELECT id FROM "user" WHERE identifier = $1', [member.email]);
    const limiter = suite.kit.app.get(RateLimiter);
    const key = `${suite.fixtures.a.businessId}:${String(user?.id)}`;
    for (let spent = 0; spent < PREVIEW_BUDGET; spent += 1) await limiter.consume('catalog-pack-preview-actor', key);
    const body = packInput([rawTestId(world.shirt.id), rawTestId(world.trousers.id)]);

    // Act
    const answer = await suite.kit.restRaw(
      'POST',
      '/catalog/packs/preview',
      new TextEncoder().encode(JSON.stringify(body)),
    );

    // Assert
    expect(answer.status).toBe(429);
    expect(Number(answer.headers.get('retry-after'))).toBeGreaterThan(0);
  });
});
