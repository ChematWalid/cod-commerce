import type { CatalogImportObjectStorage } from '@cod/plugin-catalog-import';
import { expect, it } from 'vitest';
import { catalogImportOf, exportKeyOf, type UploadedObjects } from '../catalog-import-world';
import type { IsolationHttp } from '../http';
import type { World } from '../world';

/** A key of the private bucket, as the storage port types it. */
type StoredKey = Parameters<CatalogImportObjectStorage['head']>[0];

/** What the private-bucket checks need from the suite: the world, the client and the booted app's storage. */
export interface ImportStorageHarness {
  readonly world: () => World;
  readonly http: IsolationHttp;
  readonly storage: () => CatalogImportObjectStorage;
}

/** The seed's writer of uploaded files, over the booted app's private bucket. */
export const uploadedObjectsOf = (storage: () => CatalogImportObjectStorage): UploadedObjects => ({
  write: (key, bytes, contentType) => storage().write(key as StoredKey, bytes, contentType),
});

/**
 * A's spreadsheet upload and export file sit under the prefix of A's business and first store in the private bucket
 * (P2.S2, D2144), and the bucket holds each of them.
 */
export function itKeepsImportFilesUnderTheirPrefix({ world, http, storage }: ImportStorageHarness): void {
  it("stores A's spreadsheet upload under the uploads prefix of A's business and store (D2144)", async () => {
    const { a } = world();
    const { uploadKey } = catalogImportOf(a).spreadsheet;

    expect(uploadKey).toMatch(new RegExp(`^uploads/b/${a.businessId}/s/${a.stores[0].id}/`));
    expect(await storage().head(uploadKey as StoredKey)).not.toBeNull();
  });

  it("stores A's export file under the exports prefix of A's business and store (D2144)", async () => {
    const { a } = world();
    const key = await exportKeyOf(http, a);

    expect(key).toMatch(new RegExp(`^exports/b/${a.businessId}/s/${a.stores[0].id}/`));
    expect(await storage().head(key as StoredKey)).not.toBeNull();
  });
}
