import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { STOREFRONT_LIST_MAX_TAKE, storefrontProductPageSchema, storefrontProductSchema } from '@cod/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { idsOf, type MadeProduct, storefrontSuite } from './storefront-kit';

const suite = storefrontSuite(940, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });

/** Products of A's first store, B's first store and A's second store, made once for the file. */
const made = {} as {
  active: MadeProduct;
  draft: MadeProduct;
  hidden: MadeProduct;
  foreign: MadeProduct;
  foreignOnly: MadeProduct;
  otherStore: MadeProduct;
};

beforeAll(async () => {
  const { kit, fixtures } = suite;
  await kit.asOwner(fixtures.b);
  made.foreign = await kit.product('Foreign kaftan', { slug: 'twin-slug' });
  made.foreignOnly = await kit.product('Foreign only kaftan', { slug: 'b-only-kaftan' });
  await kit.asOwner(fixtures.a, fixtures.a.stores[1]);
  made.otherStore = await kit.product('Other store kaftan');
  await kit.asOwner(fixtures.a);
  made.active = await kit.product('Kaftan rouge', { slug: 'twin-slug', price: 4500 });
  made.draft = await kit.product('Draft kaftan', { status: 'draft' });
  made.hidden = await kit.product('Hidden kaftan', { status: 'hidden' });
  // The projection follows the outbox: wait until A's list shows its active product.
  await kit.storeUntil('/store/products', fixtures.a.stores[0].id, (answer) => idsOf(answer).includes(made.active.id));
});

describe('GET /store/products', () => {
  it("lists only the signed store's active products, in the shared page shape", async () => {
    // Act
    const answer = await suite.kit.store('/store/products', suite.fixtures.a.stores[0].id);

    // Assert
    expect(answer.status).toBe(200);
    expect(storefrontProductPageSchema.safeParse(answer.body).success).toBe(true);
    const ids = idsOf(answer);
    expect(ids).toContain(made.active.id);
    expect(ids).not.toContain(made.draft.id);
    expect(ids).not.toContain(made.hidden.id);
    expect(ids).not.toContain(made.foreign.id);
    expect(ids).not.toContain(made.otherStore.id);
  });

  it('clamps take to the largest page and reads malformed paging as the defaults', async () => {
    // Act
    const huge = await suite.kit.store('/store/products?take=1000', suite.fixtures.a.stores[0].id);
    const malformed = await suite.kit.store(
      '/store/products?take=abc&skip=-4&sort=evil',
      suite.fixtures.a.stores[0].id,
    );

    // Assert
    expect(huge.body).toMatchObject({ take: STOREFRONT_LIST_MAX_TAKE });
    expect(malformed.status).toBe(200);
    expect(malformed.body).toMatchObject({ skip: 0, take: 24 });
  });

  it('answers 404 with an empty body to an unsigned call, an unknown store and a malformed store id', async () => {
    // Act
    const answers = await Promise.all([
      suite.kit.store('/store/products'),
      suite.kit.store('/store/products', '7340032000000099'),
      suite.kit.store('/store/products', '1 OR 1=1'),
    ]);

    // Assert
    expect(answers.map(({ status, text }) => ({ status, text }))).toEqual([
      { status: 404, text: '' },
      { status: 404, text: '' },
      { status: 404, text: '' },
    ]);
  });
});

describe('GET /store/product/:slug', () => {
  it("answers A's own product when B uses the same slug, in the shared product shape", async () => {
    // Act
    const answer = await suite.kit.store('/store/product/twin-slug', suite.fixtures.a.stores[0].id);

    // Assert
    expect(answer.status).toBe(200);
    expect(storefrontProductSchema.safeParse(answer.body).success).toBe(true);
    expect(answer.body).toMatchObject({ id: made.active.id, name: 'Kaftan rouge' });
  });

  it("answers 404 with an empty body for B's slug, a draft, a hidden product, an unknown and a huge slug", async () => {
    // Arrange
    const storeA = suite.fixtures.a.stores[0].id;
    const slugs = [
      made.foreignOnly.slug,
      made.otherStore.slug,
      made.draft.slug,
      made.hidden.slug,
      'nope',
      'x'.repeat(2000),
    ];

    // Act
    const answers = await Promise.all(slugs.map((slug) => suite.kit.store(`/store/product/${slug}`, storeA)));

    // Assert
    expect(answers.map(({ status, text }) => ({ status, text }))).toEqual(slugs.map(() => ({ status: 404, text: '' })));
  });

  it('never reads search as a product slug: the search route answers a page', async () => {
    // Act
    const answer = await suite.kit.store('/store/product/search?q=kaftan', suite.fixtures.a.stores[0].id);

    // Assert
    expect(answer.status).toBe(200);
    expect(storefrontProductPageSchema.safeParse(answer.body).success).toBe(true);
  });
});
