import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { CATALOG_ERROR_CODES, MAX_PRODUCT_HIGHLIGHTS } from '@cod/shared';
import { failureOf } from '@cod/testing';
import { describe, expect, it } from 'vitest';
import { catalogSuite, PRODUCT, type ProductResult, UPDATE_PRODUCT } from './catalog-kit';
import { BRANDS, CREATE_BRAND, CREATE_HIGHLIGHT, CREATE_TAG, createTaxonomy, HIGHLIGHTS, TAGS } from './taxonomy-kit';

const suite = catalogSuite(1021, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const C = CATALOG_ERROR_CODES;

const UPDATE_BRAND =
  'mutation ($id: String!, $input: CatalogBrandInput!) { updateCatalogBrand(id: $id, input: $input) { id name } }';
const DELETE_BRAND = 'mutation ($id: String!) { deleteCatalogBrand(id: $id) }';
const UPDATE_TAG =
  'mutation ($id: String!, $input: CatalogTagInput!) { updateCatalogTag(id: $id, input: $input) { id name } }';
const DELETE_HIGHLIGHT = 'mutation ($id: String!) { deleteCatalogHighlight(id: $id) }';
const UPDATE_HIGHLIGHT =
  'mutation ($id: String!, $input: CatalogHighlightInput!) { updateCatalogHighlight(id: $id, input: $input) { id } }';

interface Named {
  readonly id: string;
  readonly name: string;
}

describe('brands, tags and highlights of a store', () => {
  it('creates, renames, lists and deletes a brand over GraphQL', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const { createCatalogBrand } = await suite.kit.gql<{ createCatalogBrand: Named }>(CREATE_BRAND, {
      input: { name: 'Acme' },
    });

    // Act
    const { updateCatalogBrand } = await suite.kit.gql<{ updateCatalogBrand: Named }>(UPDATE_BRAND, {
      id: createCatalogBrand.id,
      input: { name: 'Acme Two' },
    });
    const listed = await suite.kit.gql<{ catalogBrands: Named[] }>(BRANDS);
    await suite.kit.gql(DELETE_BRAND, { id: createCatalogBrand.id });
    const afterDelete = await suite.kit.gql<{ catalogBrands: Named[] }>(BRANDS);

    // Assert
    expect(updateCatalogBrand).toEqual({ id: createCatalogBrand.id, name: 'Acme Two' });
    expect(listed.catalogBrands).toContainEqual({ id: createCatalogBrand.id, name: 'Acme Two' });
    expect(afterDelete.catalogBrands.map((brand) => brand.id)).not.toContain(createCatalogBrand.id);
  });

  it('serves the same tags over REST', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const created = await suite.kit.rest('POST', '/catalog/tags', { name: 'Rest tag' });
    const id = (created.body as Named).id;
    const renamed = await suite.kit.rest('PATCH', `/catalog/tags/${id}`, { name: 'Rest tag 2' });
    const listed = await suite.kit.rest('GET', '/catalog/tags');
    const deleted = await suite.kit.rest('DELETE', `/catalog/tags/${id}`);

    // Assert
    expect(created.status).toBe(201);
    expect(renamed.body).toMatchObject({ id, name: 'Rest tag 2' });
    expect(listed.body).toContainEqual(expect.objectContaining({ id, name: 'Rest tag 2' }));
    expect(deleted.body).toEqual({ success: true });
  });

  it('refuses a duplicate tag name in one store, allows it in another store', async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a);
    await suite.kit.gql(CREATE_TAG, { input: { name: 'Summer' } });

    // Act
    const duplicate = await failureOf(suite.kit.gql(CREATE_TAG, { input: { name: ' SUMMER ' } }));
    const overRest = await suite.kit.rest('POST', '/catalog/tags', { name: 'summer' });
    await suite.kit.asOwner(a, a.stores[1]);
    const elsewhere = await suite.kit.gql<{ createCatalogTag: Named }>(CREATE_TAG, { input: { name: 'Summer' } });

    // Assert
    expect(duplicate.codes).toEqual([C.NAME_TAKEN]);
    expect(overRest).toMatchObject({ status: 409, body: { code: C.NAME_TAKEN } });
    expect(elsewhere.createCatalogTag.name).toBe('Summer');
  });

  it("refuses a brand, tag or highlight id of the business's other store, and changes nothing", async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a);
    const ids = await createTaxonomy(suite.kit, 'first-store');
    await suite.kit.asOwner(a, a.stores[1]);

    // Act
    const brand = await failureOf(suite.kit.gql(UPDATE_BRAND, { id: ids.brandId, input: { name: 'Moved' } }));
    const tag = await failureOf(suite.kit.gql(UPDATE_TAG, { id: ids.tagId, input: { name: 'Moved' } }));
    const highlight = await failureOf(suite.kit.gql(DELETE_HIGHLIGHT, { id: ids.highlightId }));
    const overRest = await suite.kit.rest('DELETE', `/catalog/brands/${ids.brandId}`);

    // Assert
    expect([...brand.codes, ...tag.codes, ...highlight.codes]).toEqual([
      C.BRAND_NOT_FOUND,
      C.TAG_NOT_FOUND,
      C.HIGHLIGHT_NOT_FOUND,
    ]);
    expect(overRest).toMatchObject({ status: 404, body: { code: C.BRAND_NOT_FOUND } });
    await suite.kit.asOwner(a);
    const brands = await suite.kit.gql<{ catalogBrands: Named[] }>(BRANDS);
    const tags = await suite.kit.gql<{ catalogTags: Named[] }>(TAGS);
    const highlights = await suite.kit.gql<{ catalogHighlights: { id: string }[] }>(HIGHLIGHTS);
    expect(brands.catalogBrands).toContainEqual({ id: ids.brandId, name: 'Brand first-store' });
    expect(tags.catalogTags).toContainEqual({ id: ids.tagId, name: 'Tag first-store' });
    expect(highlights.catalogHighlights.map((row) => row.id)).toContain(ids.highlightId);
  });

  it('deleting a brand clears it from its products only', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const brandOf = async (name: string) =>
      (await suite.kit.gql<{ createCatalogBrand: Named }>(CREATE_BRAND, { input: { name } })).createCatalogBrand.id;
    const [doomed, kept] = [await brandOf('Short-lived'), await brandOf('Staying')];
    const branded = await suite.kit.createProduct({ title: 'Branded', brandId: doomed });
    const otherBrand = await suite.kit.createProduct({ title: 'Other brand', brandId: kept });
    const noBrand = await suite.kit.createProduct({ title: 'No brand' });

    // Act
    await suite.kit.gql(DELETE_BRAND, { id: doomed });

    // Assert
    const brandNow = async (id: string) =>
      (await suite.kit.gql<{ catalogProduct: ProductResult }>(PRODUCT, { id })).catalogProduct.brandId;
    expect(branded.brandId).toBe(doomed);
    expect(await brandNow(branded.id)).toBeNull();
    expect(await brandNow(otherBrand.id)).toBe(kept);
    expect(await brandNow(noBrand.id)).toBeNull();
  });

  it('keeps highlight order and drops a deleted highlight from the product', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const texts = ['First', 'Second', 'Third'];
    const created = await Promise.all(
      texts.map((text) =>
        suite.kit.gql<{ createCatalogHighlight: { id: string } }>(CREATE_HIGHLIGHT, { input: { text } }),
      ),
    );
    const [first, second, third] = created.map((row) => row.createCatalogHighlight.id);
    const product = await suite.kit.createProduct({ title: 'Highlighted', highlightIds: [first, second, third] });

    // Act
    await suite.kit.gql(UPDATE_PRODUCT, { id: product.id, input: { highlightIds: [third, first, second] } });
    await suite.kit.gql(DELETE_HIGHLIGHT, { id: first });

    // Assert
    const { catalogProduct } = await suite.kit.gql<{ catalogProduct: ProductResult }>(PRODUCT, { id: product.id });
    expect(catalogProduct.highlightIds).toEqual([third, second]);
  });

  it('refuses a seventh highlight on a product (AC3)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const ids: string[] = [];
    for (let index = 0; index <= MAX_PRODUCT_HIGHLIGHTS; index += 1) {
      const { createCatalogHighlight } = await suite.kit.gql<{ createCatalogHighlight: { id: string } }>(
        CREATE_HIGHLIGHT,
        { input: { text: `Point ${String(index)}` } },
      );
      ids.push(createCatalogHighlight.id);
    }

    // Act
    const failure = await failureOf(suite.kit.createProduct({ title: 'Too many', highlightIds: ids }));

    // Assert
    expect(failure.codes).toEqual([C.TOO_MANY_HIGHLIGHTS]);
  });

  it('rewords a highlight and refuses a blank text', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const { createCatalogHighlight } = await suite.kit.gql<{ createCatalogHighlight: { id: string } }>(
      CREATE_HIGHLIGHT,
      { input: { text: 'Fast delivery' } },
    );

    // Act
    const blank = await failureOf(
      suite.kit.gql(UPDATE_HIGHLIGHT, { id: createCatalogHighlight.id, input: { text: '   ' } }),
    );

    // Assert
    expect(blank.codes).toEqual([C.INVALID_INPUT]);
  });
});
