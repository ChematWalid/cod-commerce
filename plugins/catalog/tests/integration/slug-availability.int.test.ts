import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { describe, expect, it } from 'vitest';
import { catalogSuite, SLUG } from './catalog-kit';

const suite = catalogSuite(1020, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const ARABIC_SLUG = 'حذاء-رياضي-أحمر';

interface SlugAnswer {
  readonly catalogSlugAvailability: { available: boolean; slug: string };
}

describe('catalogSlugAvailability (D2103, D500)', () => {
  const check = async (slug: string, productId?: string) =>
    (await suite.kit.gql<SlugAnswer>(SLUG, { slug, productId })).catalogSlugAvailability;

  it('reports an Arabic slug taken whatever its Unicode normal form (Review Focus 1)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const product = await suite.kit.createProduct({ title: 'حذاء رياضي أحمر' });

    // Act
    const nfc = await check(ARABIC_SLUG.normalize('NFC'));
    const nfd = await check(ARABIC_SLUG.normalize('NFD'));
    const self = await check(ARABIC_SLUG, product.id);

    // Assert
    expect(product.slug).toBe(ARABIC_SLUG.normalize('NFD'));
    expect([nfc.available, nfd.available, self.available]).toEqual([false, false, true]);
  });

  it("reports a slug of A's store free in B's store, and lets B save it too", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    await suite.kit.createProduct({ title: 'Shared', slug: 'shared-slug' });
    await suite.kit.asOwner(suite.fixtures.b);

    // Act
    const inB = await check('shared-slug');
    const saved = await suite.kit.createProduct({ title: 'Shared', slug: 'shared-slug' });

    // Assert
    expect(inB.available).toBe(true);
    expect(saved.slug).toBe('shared-slug');
  });

  it('answers the same over REST', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    await suite.kit.createProduct({ title: 'Rest slug', slug: 'rest-slug' });

    // Act
    const answer = await suite.kit.rest('GET', '/catalog/products/slug-availability?slug=rest-slug');

    // Assert
    expect(answer.body).toEqual({ available: false, slug: 'rest-slug' });
  });
});
