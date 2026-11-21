import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createCollection, rawId, UPDATE_COLLECTION } from './collections-api';
import { collectionsSuite } from './collections-kit';
import { productIdsOf } from './collections-products';
import {
  brandIs,
  type ConditionInput,
  createBrand,
  createRuleProduct,
  createTag,
  hideVariantsWith,
  optionIs,
  priceBetween,
  ruleOf,
  tagIs,
} from './collections-rules-api';

const suite = collectionsSuite(1016, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });

/** A's seeded catalog (GraphQL ids), each product built for one corner of the rule semantics. */
interface Catalog {
  promoTag: string;
  plainTag: string;
  acmeBrand: string;
  promoCheap: string;
  promoDear: string;
  plainCheap: string;
  plainDear: string;
  bare: string;
  redShirt: string;
  hiddenRed: string;
}

const catalog = {} as Catalog;
const CHEAP = priceBetween(1_000, 5_000);

/** Creates an automatic collection of A with `rule` and answers its id and member ids in collection order. */
async function automaticWith(rule: unknown): Promise<{ id: string; members: string[]; productCount: number }> {
  const collection = await createCollection(suite.kit, { mode: 'automatic', rule });
  return {
    id: collection.id,
    members: await productIdsOf(suite.kit, collection.id),
    productCount: collection.productCount,
  };
}

/** Newest product first, the order of automatic members (D2318). */
const newestFirst = (...ids: string[]): string[] =>
  [...ids].sort((left, right) => Number(rawId(right)) - Number(rawId(left)));

const one = (...conditions: ConditionInput[]) => ruleOf('all', ...conditions);

describe('automatic collections match their rule at save (D2302-D2304, D2312)', () => {
  beforeAll(async () => {
    await suite.kit.asOwner(suite.fixtures.b);
    const tagOfB = await createTag(suite.kit, 'promo');
    await createRuleProduct(suite.kit, {
      title: 'Red shirt',
      sku: 'B-RS',
      tagIds: [tagOfB],
      price: 2_000,
      optionGroups: [{ name: 'Color', values: ['Red'] }],
    });
    await suite.kit.asOwner(suite.fixtures.a);
    catalog.promoTag = await createTag(suite.kit, 'promo');
    catalog.plainTag = await createTag(suite.kit, 'plain');
    catalog.acmeBrand = await createBrand(suite.kit, 'Acme');
    const make = async (title: string, input: Record<string, unknown>): Promise<string> =>
      (await createRuleProduct(suite.kit, { title, ...input })).id;
    catalog.promoCheap = await make('Promo cheap', {
      tagIds: [catalog.promoTag],
      brandId: catalog.acmeBrand,
      price: 1_500,
    });
    catalog.promoDear = await make('Promo dear', { tagIds: [catalog.promoTag], price: 9_000 });
    catalog.plainCheap = await make('Plain cheap', { tagIds: [catalog.plainTag], price: 1_200 });
    catalog.plainDear = await make('Plain dear', { tagIds: [catalog.plainTag], price: 8_000 });
    catalog.bare = await make('Bare', { price: 9_500 });
    const color = (values: string[]) => [{ name: 'Color', values }];
    catalog.redShirt = await make('Red shirt', { sku: 'A-RS', price: 7_000, optionGroups: color(['Red', 'Blue']) });
    const hidden = await createRuleProduct(suite.kit, {
      title: 'Hidden red',
      sku: 'A-HR',
      price: 7_500,
      optionGroups: color(['Red', 'Green']),
    });
    await hideVariantsWith(suite.kit, hidden, 'Red');
    catalog.hiddenRed = hidden.id;
  });

  beforeEach(async () => {
    await suite.kit.asOwner(suite.fixtures.a);
  });

  const everyProduct = (): string[] => [
    catalog.promoCheap,
    catalog.promoDear,
    catalog.plainCheap,
    catalog.plainDear,
    catalog.bare,
    catalog.redShirt,
    catalog.hiddenRed,
  ];

  it('AC1: match All returns the intersection, match Any the union', async () => {
    // Act
    const all = await automaticWith(ruleOf('all', tagIs('is_any_of', catalog.promoTag), CHEAP));
    const any = await automaticWith(ruleOf('any', tagIs('is_any_of', catalog.promoTag), CHEAP));

    // Assert
    expect(all.members).toEqual([catalog.promoCheap]);
    expect(all.productCount).toBe(1);
    expect(any.members).toEqual(newestFirst(catalog.promoCheap, catalog.promoDear, catalog.plainCheap));
  });

  it('AC2: is not tag or brand includes untagged and brandless products', async () => {
    // Act
    const notPromo = await automaticWith(one(tagIs('is_not', catalog.promoTag)));
    const notAcme = await automaticWith(one(brandIs('is_not', catalog.acmeBrand)));

    // Assert
    const promos = new Set([catalog.promoCheap, catalog.promoDear]);
    expect(notPromo.members).toEqual(newestFirst(...everyProduct().filter((id) => !promos.has(id))));
    expect(notAcme.members).toEqual(newestFirst(...everyProduct().filter((id) => id !== catalog.promoCheap)));
  });

  it('AC3: Color is any of [Red] matches visible Red variants only; is not [Red] takes the rest', async () => {
    // Act
    const red = await automaticWith(one(optionIs('Color', 'is_any_of', 'red')));
    const notRed = await automaticWith(one(optionIs('Color', 'is_not', 'Red')));

    // Assert
    expect(red.members).toEqual([catalog.redShirt]);
    expect(notRed.members).toEqual(newestFirst(...everyProduct().filter((id) => id !== catalog.redShirt)));
  });

  it('editing the rule recomputes at save, over GraphQL and REST', async () => {
    // Arrange
    const collection = await automaticWith(one(tagIs('is_any_of', catalog.plainTag)));

    // Act
    await suite.kit.gql(UPDATE_COLLECTION, {
      id: collection.id,
      input: { rule: one(tagIs('is_any_of', catalog.promoTag)) },
    });
    const afterGraphql = await productIdsOf(suite.kit, collection.id);
    const rest = await suite.kit.rest('PATCH', `/catalog/collections/${rawId(collection.id)}`, { rule: one(CHEAP) });
    const afterRest = await productIdsOf(suite.kit, collection.id);

    // Assert
    expect(afterGraphql).toEqual(newestFirst(catalog.promoCheap, catalog.promoDear));
    expect(rest.status).toBe(200);
    expect(rest.body).toMatchObject({ mode: 'automatic', productCount: 2 });
    expect(afterRest).toEqual(newestFirst(catalog.promoCheap, catalog.plainCheap));
  });

  it('switching automatic to manual keeps the members and their order', async () => {
    // Arrange
    const collection = await automaticWith(one(tagIs('is_any_of', catalog.promoTag)));

    // Act
    await suite.kit.gql(UPDATE_COLLECTION, { id: collection.id, input: { mode: 'manual' } });

    // Assert
    expect(await productIdsOf(suite.kit, collection.id)).toEqual(collection.members);
    const positions = await suite.kit.query<{ position: number }>(
      'SELECT position FROM collections_member WHERE "collectionId" = $1 ORDER BY position',
      [rawId(collection.id)],
    );
    expect(positions.map((row) => row.position)).toEqual([0, 1]);
  });

  it('switching manual to automatic replaces the hand-picked members with the matches', async () => {
    // Arrange
    const manual = await createCollection(suite.kit);
    await suite.kit.rest('PUT', `/catalog/collections/${rawId(manual.id)}/products`, {
      productIds: [rawId(catalog.bare)],
    });

    // Act
    await suite.kit.gql(UPDATE_COLLECTION, {
      id: manual.id,
      input: { mode: 'automatic', rule: one(tagIs('is_any_of', catalog.plainTag)) },
    });

    // Assert
    expect(await productIdsOf(suite.kit, manual.id)).toEqual(newestFirst(catalog.plainCheap, catalog.plainDear));
  });

  it("A's rule never matches B's products, even with the same title, tag name and option", async () => {
    // Act
    const red = await automaticWith(one(optionIs('Color', 'is_any_of', 'Red')));
    const titled = await automaticWith(one({ field: 'title', operator: 'contains', values: ['Red shirt'] }));

    // Assert
    expect(red.members).toEqual([catalog.redShirt]);
    expect(titled.members).toEqual([catalog.redShirt]);
  });
});
