import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { describe, expect, it } from 'vitest';
import { catalogSuite, rawId, UPDATE_PRODUCT } from './catalog-kit';
import {
  CatalogReadProbePlugin,
  NO_ACTIVE_STORE_REFUSAL,
  type ProbedProduct,
  type ProbedShape,
} from './catalog-read-probe';
import { createMedia } from './media-kit';

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

async function shapeOf(slug: string): Promise<ProbedShape | null> {
  const answer = await suite.kit.rest('GET', `/test/catalog-read/shape?slug=${slug}`);
  return answer.body as ProbedShape | null;
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

  it('refuses a context that is not public, such as the admin one', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    await suite.kit.createProduct({ title: 'Read admin draft', slug: 'read-admin-draft', status: 'draft' });

    // Act
    const listing = await suite.kit.rest('GET', '/test/catalog-read/list?context=admin');
    const finding = await suite.kit.rest('GET', '/test/catalog-read/slug?slug=read-admin-draft&context=admin');

    // Assert
    expect(JSON.stringify(listing.body)).not.toContain('Read admin draft');
    expect(listing.status).not.toBe(200);
    expect(finding.status).not.toBe(200);
  });

  it('refuses a context without an active store (D2142)', async () => {
    // Act
    const answer = await suite.kit.rest('GET', '/test/catalog-read/untenanted');

    // Assert: 409 only when NoActiveStoreError refused the read; any other fault stays a 500
    expect(answer.status).toBe(409);
    expect(answer.body).toMatchObject({ message: NO_ACTIVE_STORE_REFUSAL });
  });

  it('a product page carries image preview paths, never URLs, and only the option values of shown variants (#246)', async () => {
    // Arrange
    const { a } = suite.fixtures;
    await behave(a.stores[0].id, 'keep');
    await suite.kit.asOwner(a);
    const media = await createMedia(suite.kit);
    const shirt = await suite.kit.createProduct({
      title: 'Read shirt',
      slug: 'read-shirt',
      sku: 'RS',
      featuredAssetId: media.assetId,
      assetIds: [media.assetId],
      optionGroups: [{ name: 'Color', values: ['Red', 'Blue'] }],
    });
    const red = shirt.variants.find((variant) => variant.optionValues[0] === 'Red');
    await suite.kit.gql(UPDATE_PRODUCT, { id: shirt.id, input: { variants: [{ id: red?.id, isHidden: true }] } });

    // Act
    const shape = await shapeOf('read-shirt');

    // Assert
    const preview = shape === null ? '' : (shape.featuredAsset?.preview ?? '');
    expect(preview).not.toMatch(/^https?:/);
    expect(preview).not.toBe('');
    expect(media.previewUrl.endsWith(preview)).toBe(true);
    expect(shape).toEqual({
      featuredAsset: { id: rawId(media.assetId), preview },
      assets: [{ id: rawId(media.assetId), preview }],
      variantPreviews: [null],
      optionGroups: [{ name: 'Color', values: ['Blue'] }],
    });
  });

  it("never shows another business's image preview or product shape", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.b);
    const media = await createMedia(suite.kit);
    await suite.kit.createProduct({
      title: 'Read foreign image',
      slug: 'read-foreign-image',
      featuredAssetId: media.assetId,
    });
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const shape = await shapeOf('read-foreign-image');

    // Assert
    expect(shape).toBeNull();
  });
});
