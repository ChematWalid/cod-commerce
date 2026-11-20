import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { describe, expect, it } from 'vitest';
import { CatalogStoreChannelMismatchError, type CoreId, toCoreId } from '../../index';
import { rawId, UPDATE_PRODUCT } from './catalog-kit';
import { contextOn, defaultContext, factsSuite, queriesOf, rawIds, scopeOf } from './facts-kit';
import { createTaxonomy } from './taxonomy-kit';

const suite = factsSuite(1020, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const FACTS_BATCH = 100;
const FEW_IDS = 10;
/** Products are created this many at a time: one GraphQL call each, a few in flight. */
const CREATE_WAVE = 10;

const DELETE_PRODUCT = 'mutation ($id: ID!) { deleteCatalogProduct(id: $id) }';

async function createMany(count: number, label: string): Promise<string[]> {
  const ids: string[] = [];
  for (let start = 0; start < count; start += CREATE_WAVE) {
    const wave = Array.from({ length: Math.min(CREATE_WAVE, count - start) }, (_, index) =>
      suite.kit.createProduct({ title: `${label} ${String(start + index)}` }),
    );
    ids.push(...rawIds(await Promise.all(wave)));
  }
  return ids;
}

describe('CatalogProductFactsReader (D2308)', () => {
  it('reads facts in the store channel', async () => {
    // Arrange
    const { a } = suite.fixtures;
    const store = a.stores[0];
    await suite.kit.asOwner(a);
    const { brandId, tagId } = await createTaxonomy(suite.kit);
    const shirt = await suite.kit.createProduct({
      title: 'Facts shirt',
      price: 2500,
      sku: 'FS',
      brandId,
      tagIds: [tagId],
      optionGroups: [{ name: 'Color', values: ['Red', 'Blue'] }],
    });
    const [red, blue] = shirt.variants;
    await suite.kit.gql(UPDATE_PRODUCT, {
      id: shirt.id,
      input: {
        variants: [
          { id: red?.id, price: 800, oldPrice: 1200, isHidden: true },
          { id: blue?.id, price: 3000, oldPrice: 3500 },
        ],
      },
    });
    const ctx = await contextOn(suite, store.channelToken);

    // Act
    const facts = await suite.reader.factsOf(ctx, scopeOf(a, store), [rawId(shirt.id)]);

    // Assert
    expect(facts).toEqual([
      {
        productId: rawId(shirt.id),
        title: 'Facts shirt',
        status: 'active',
        brandId,
        tagIds: [tagId],
        price: 3000,
        onSale: true,
        variantOptions: [[{ name: 'Color', value: 'Blue' }]],
      },
    ]);
  });

  it('leaves an option without any translation out of the variant options, as the picker does', async () => {
    // Arrange
    const { a } = suite.fixtures;
    const store = a.stores[0];
    await suite.kit.asOwner(a);
    const product = await suite.kit.createProduct({
      title: 'Facts fit',
      sku: 'FF',
      optionGroups: [{ name: 'Fit', values: ['Slim', 'Untranslated fit'] }],
    });
    await suite.kit.query(
      `DELETE FROM "product_option_translation" t USING "product_option" o, "product_option_groups_product_option_group" pg
       WHERE t."baseId" = o."id" AND pg."productOptionGroupId" = o."groupId" AND pg."productId" = $1
         AND t."name" = 'Untranslated fit'`,
      [Number(rawId(product.id))],
    );
    const ctx = await contextOn(suite, store.channelToken);

    // Act
    const [facts] = await suite.reader.factsOf(ctx, scopeOf(a, store), [rawId(product.id)]);

    // Assert
    expect(facts?.variantOptions).toEqual([[{ name: 'Fit', value: 'Slim' }], []]);
  });

  it('reads 100 products in at most 3 product queries, and in as many statements as 10 products', async () => {
    // Arrange
    const { a } = suite.fixtures;
    const store = a.stores[0];
    await suite.kit.asOwner(a);
    const ids = await createMany(FACTS_BATCH, 'Batch');
    const ctx = await contextOn(suite, store.channelToken);
    const scope = scopeOf(a, store);
    let read = 0;
    // One read first, so caches that fill once per context (channel, tenant session) count in neither measurement:
    // in CI's catalog-2 part this file can be the first to touch them, and the first read then paid 2 extra statements.
    await suite.reader.factsOf(ctx, scope, ids.slice(0, 1));

    // Act
    const few = await queriesOf(suite, () => suite.reader.factsOf(ctx, scope, ids.slice(0, FEW_IDS)));
    const many = await queriesOf(suite, async () => {
      read = (await suite.reader.factsOf(ctx, scope, ids)).length;
    });

    // Assert
    expect(read).toBe(FACTS_BATCH);
    // At least one: the counter sees the reads at all.
    expect(many.product).toBeGreaterThanOrEqual(1);
    expect(many.product).toBeLessThanOrEqual(3);
    // No statement anywhere in the call (channel check, tenant session) grows with the ids.
    expect(many.all).toBe(few.all);
  });

  it('refuses a default-channel context, and a context of the business’s other store', async () => {
    // Arrange
    const { a } = suite.fixtures;
    const scope = scopeOf(a, a.stores[0]);
    const contexts = [await defaultContext(suite), await contextOn(suite, a.stores[1].channelToken)];

    // Act
    const refusals: unknown[] = [];
    for (const ctx of contexts) {
      for (const read of [
        () => suite.reader.factsOf(ctx, scope, []),
        () => suite.reader.pageIds(ctx, scope, { after: null, take: 10 }),
        () => suite.reader.ruleOptionsOf(ctx, scope),
      ]) {
        refusals.push(
          await read().then(
            () => undefined,
            (error: unknown) => error,
          ),
        );
      }
    }

    // Assert
    expect(refusals).toHaveLength(6);
    for (const refusal of refusals) expect(refusal).toBeInstanceOf(CatalogStoreChannelMismatchError);
  });

  it("leaves out B's product ids, A's other-store and deleted ids and malformed ids", async () => {
    // Arrange
    const { a, b } = suite.fixtures;
    await suite.kit.asOwner(a);
    const own = await suite.kit.createProduct({ title: 'Facts own' });
    const deleted = await suite.kit.createProduct({ title: 'Facts deleted' });
    await suite.kit.gql(DELETE_PRODUCT, { id: deleted.id });
    await suite.kit.asOwner(a, a.stores[1]);
    const otherStore = await suite.kit.createProduct({ title: 'Facts other store' });
    await suite.kit.asOwner(b);
    const foreign = await suite.kit.createProduct({ title: 'Facts foreign' });
    const ctx = await contextOn(suite, a.stores[0].channelToken);
    const asked = [...rawIds([own, deleted, otherStore, foreign]), 'abc', '-1', '1.5', '', '99999999999999999999'];

    // Act
    const facts = await suite.reader.factsOf(ctx, scopeOf(a, a.stores[0]), asked);

    // Assert
    expect(facts.map((fact) => fact.productId)).toEqual([rawId(own.id)]);
  });

  it('pageIds walks every product once when one is deleted between pages', async () => {
    // Arrange
    const { b } = suite.fixtures;
    const store = b.stores[1];
    await suite.kit.asOwner(b, store);
    const created = await createMany(5, 'Walk');
    const ctx = await contextOn(suite, store.channelToken);
    const scope = scopeOf(b, store);
    const first = await suite.reader.pageIds(ctx, scope, { after: null, take: 2 });
    await suite.kit.gql(DELETE_PRODUCT, { id: `T_${String(first.ids[0])}` });
    const seen: CoreId[] = [...first.ids];
    let after = first.next;

    // Act
    while (after !== null) {
      const page = await suite.reader.pageIds(ctx, scope, { after, take: 2 });
      seen.push(...page.ids);
      after = page.next;
    }

    // Assert
    const newestFirst = [...created].sort((left, right) => Number(right) - Number(left));
    expect(seen).toEqual(newestFirst);
  });

  it('pageIds narrows to the titles holding the search text', async () => {
    // Arrange
    const { b } = suite.fixtures;
    const store = b.stores[0];
    await suite.kit.asOwner(b, store);
    const lamp = await suite.kit.createProduct({ title: 'Desk lamp 50%' });
    await suite.kit.createProduct({ title: 'Desk lamp 50 cm' });
    const ctx = await contextOn(suite, store.channelToken);

    // Act
    const page = await suite.reader.pageIds(ctx, scopeOf(b, store), { after: null, take: 10, search: 'LAMP 50%' });

    // Assert
    expect(page).toEqual({ ids: [toCoreId(rawId(lamp.id))], next: null });
  });

  it("ruleOptionsOf lists Color and Size of the store only (B's Material never appears)", async () => {
    // Arrange
    const { a, b } = suite.fixtures;
    const store = a.stores[1];
    await suite.kit.asOwner(b, b.stores[0]);
    await suite.kit.createProduct({ title: 'Rug', sku: 'RG', optionGroups: [{ name: 'Material', values: ['Wool'] }] });
    await suite.kit.asOwner(a, store);
    const { brandId, tagId } = await createTaxonomy(suite.kit, 'options');
    const optionGroups = [
      { name: 'Color', values: ['Red', 'Blue'] },
      { name: 'Size', values: ['S', 'M'] },
    ];
    await suite.kit.createProduct({ title: 'Tee', sku: 'TE', optionGroups });
    await suite.kit.createProduct({ title: 'Cap', sku: 'CP', optionGroups: [{ name: 'color', values: ['red'] }] });
    const ctx = await contextOn(suite, store.channelToken);

    // Act
    const options = await suite.reader.ruleOptionsOf(ctx, scopeOf(a, store));

    // Assert
    expect(options.options).toEqual([
      { name: 'Color', values: ['Blue', 'Red'] },
      { name: 'Size', values: ['M', 'S'] },
    ]);
    expect(options.brands).toEqual([{ id: brandId, name: 'Brand options' }]);
    expect(options.tags).toEqual([{ id: tagId, name: 'Tag options' }]);
  });
});
