import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { describe, expect, it } from 'vitest';
import { catalogSuite, UPDATE_PRODUCT } from './catalog-kit';
import { CatalogReadProbePlugin, type ProbedProduct } from './catalog-read-probe';

const suite = catalogSuite(1023, {
  plugins: [RbacPlugin, CatalogReadProbePlugin],
  partitionedSchemas: [ACTIVITY_LOG_SCHEMA],
});

/** Sets the sold-out behaviour of `storeId` as the store settings screen would. */
const behave = (storeId: string, behaviour: 'keep' | 'hide') =>
  suite.kit.query(`UPDATE "store" SET "soldOutBehavior" = $1 WHERE "id" = $2`, [behaviour, storeId]);

async function listed(context: string): Promise<ProbedProduct[]> {
  const answer = await suite.kit.rest('GET', `/test/catalog-read/list?context=${context}`);
  return answer.body as ProbedProduct[];
}

async function bySlug(slug: string, context: string): Promise<ProbedProduct | null> {
  const answer = await suite.kit.rest('GET', `/test/catalog-read/slug?slug=${slug}&context=${context}`);
  return answer.body as ProbedProduct | null;
}

describe('CatalogReadService on a live server (AC2, AC6, D2109, D2142)', () => {
  it('lists active products, never drafts or hidden ones, and finds a hidden one by slug for a landing page only', async () => {
    // Arrange
    const { a } = suite.fixtures;
    await behave(a.stores[0].id, 'keep');
    await suite.kit.asOwner(a);
    await suite.kit.createProduct({ title: 'Read active', status: 'active' });
    await suite.kit.createProduct({ title: 'Read hidden', slug: 'read-hidden', status: 'hidden' });
    await suite.kit.createProduct({ title: 'Read draft', slug: 'read-draft', status: 'draft' });

    // Act
    const titles = (await listed('listing')).map((item) => item.title);

    // Assert
    expect(titles).toContain('Read active');
    expect(titles).not.toContain('Read hidden');
    expect(titles).not.toContain('Read draft');
    expect(await bySlug('read-hidden', 'productPage')).toBeNull();
    expect(await bySlug('read-hidden', 'landingPage')).toMatchObject({ title: 'Read hidden' });
    expect(await bySlug('read-draft', 'landingPage')).toBeNull();
  });

  it('keep flags a sold-out product, hide removes it from the listing but not from its landing page', async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a);
    const lamp = await suite.kit.createProduct({ title: 'Read sold out', slug: 'read-sold-out' });
    await suite.kit.gql(UPDATE_PRODUCT, { id: lamp.id, input: { settings: { soldOut: true } } });
    await behave(a.stores[0].id, 'keep');
    const kept = await listed('listing');

    // Act
    await behave(a.stores[0].id, 'hide');
    const hidden = await listed('listing');

    // Assert
    expect(kept).toContainEqual({ title: 'Read sold out', soldOut: true, orderable: true });
    expect(hidden.map((item) => item.title)).not.toContain('Read sold out');
    expect(await bySlug('read-sold-out', 'landingPage')).toMatchObject({ soldOut: true });
  });

  it("never shows another business's product", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.b);
    await suite.kit.createProduct({ title: 'Read foreign', slug: 'read-foreign' });
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const titles = (await listed('listing')).map((item) => item.title);

    // Assert
    expect(titles).not.toContain('Read foreign');
    expect(await bySlug('read-foreign', 'landingPage')).toBeNull();
  });

  it('refuses a context without an active store (D2142)', async () => {
    // Act
    const answer = await suite.kit.rest('GET', '/test/catalog-read/untenanted');

    // Assert
    expect(answer.status).toBe(500);
  });
});
