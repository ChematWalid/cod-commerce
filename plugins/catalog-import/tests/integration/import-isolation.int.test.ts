import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { CATALOG_IMPORT_ERROR_CODES } from '@cod/shared';
import { failureOf } from '@cod/testing';
import { describe, expect, it } from 'vitest';
import { keyOfLink } from './export-kit';
import { importSuite } from './import-kit';
import { csvOf, importClient, previewed } from './import-flow-kit';

const suite = importSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const client = importClient(suite);
const NOT_FOUND = CATALOG_IMPORT_ERROR_CODES.JOB_NOT_FOUND;
const UPLOAD = `mutation ($input: CatalogImportUploadInput!) {
  createCatalogImportUpload(input: $input) { importId uploadUrl }
}`;

/** A product's title as the signed-in caller reads it. */
async function titleOf(id: string): Promise<string | undefined> {
  const { catalogProduct } = await suite.kit.gql<{ catalogProduct: { title: string } | null }>(
    'query ($id: ID!) { catalogProduct(id: $id) { title } }',
    { id },
  );
  return catalogProduct?.title;
}

describe('spreadsheet import isolation (AC6, D2207, D2209)', () => {
  it("a row with business B's SKU creates in A and leaves B unchanged", async () => {
    // Arrange
    const { a, b } = suite.fixtures;
    await suite.kit.asOwner(b);
    const ofB = await suite.kit.createProduct({ title: 'Kept by B', sku: 'ISO-SHARED' });
    await suite.kit.asOwner(a);

    // Act
    const bytes = csvOf([
      ['product_key', 'name', 'price'],
      ['ISO-SHARED', 'Written by A', '10'],
    ]);
    const { importId, preview } = await previewed(client, { format: 'csv', bytes });
    await client.confirm(importId);
    const done = await client.settled(importId);

    // Assert
    expect(preview.items[0]).toMatchObject({ action: 'create', productKey: 'ISO-SHARED' });
    expect(done.result).toEqual({ created: 1, updated: 0, failed: 0 });
    await suite.kit.asOwner(b);
    expect(await titleOf(ofB.id)).toBe('Kept by B');
  });

  it('a SKU held only in store 2 of the same business creates in store 1 and leaves store 2 unchanged', async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a, a.stores[1]);
    const inStore2 = await suite.kit.createProduct({ title: 'Kept in store 2', sku: 'ISO-STORE-2' });
    await suite.kit.asOwner(a);

    // Act
    const bytes = csvOf([
      ['product_key', 'name', 'price'],
      ['ISO-STORE-2', 'Written in store 1', '10'],
    ]);
    const { importId, preview } = await previewed(client, { format: 'csv', bytes });
    await client.confirm(importId);
    await client.settled(importId);

    // Assert
    expect(preview.items[0]).toMatchObject({ action: 'create' });
    await suite.kit.asOwner(a, a.stores[1]);
    expect(await titleOf(inStore2.id)).toBe('Kept in store 2');
  });

  it("B's import id → not found on get, preview, confirm and its report", async () => {
    // Arrange
    const { a, b } = suite.fixtures;
    await suite.kit.asOwner(b);
    const { importId } = await previewed(client, {
      format: 'csv',
      bytes: csvOf([
        ['name', 'price'],
        ['Of B', '1'],
      ]),
    });
    await suite.kit.asOwner(a);

    // Act
    const failures = await Promise.all([
      failureOf(client.status(importId)),
      failureOf(client.page(importId, 0, 10)),
      failureOf(client.preview(importId)),
      failureOf(client.confirm(importId)),
      failureOf(client.analyze(importId)),
    ]);
    const rest = await suite.kit.rest('GET', `/catalog/import-export/products/imports/${importId}`);

    // Assert
    expect(failures.map((failure) => failure.codes)).toEqual(Array.from({ length: 5 }, () => [NOT_FOUND]));
    expect(rest).toMatchObject({ status: 404, body: { code: NOT_FOUND } });
    await suite.kit.asOwner(b);
    expect((await client.status(importId)).status).toBe('previewed');
  });

  it("a member restricted to store 1 cannot read store 2's import", async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a, a.stores[1]);
    const { importId } = await client.upload({ format: 'csv', bytes: csvOf([['name', 'price']]) });
    await suite.kit.signInAsMember(a, ['catalog.products.view', 'catalog.products.create'], [a.stores[0]]);

    // Act
    const failure = await failureOf(client.status(importId));

    // Assert
    expect(failure.codes).toEqual([NOT_FOUND]);
  });

  it('upload URL key is under uploads/b/<A>/s/<store>/; A reads its own import (positive control)', async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a);

    // Act
    const { createCatalogImportUpload: started } = await suite.kit.gql<{
      createCatalogImportUpload: { importId: string; uploadUrl: string };
    }>(UPLOAD, { input: { format: 'csv', size: 10, contentType: 'text/csv' } });

    // Assert
    expect(keyOfLink(started.uploadUrl)).toBe(
      `uploads/b/${a.businessId}/s/${a.stores[0].id}/imports/${started.importId}/source`,
    );
    expect((await client.status(started.importId)).status).toBe('awaiting_upload');
  });
});
