import { describe, expect, it } from 'vitest';
import { importSnapshotFrom } from '../isolation/catalog-import-world';
import type { Exchange } from '../isolation/http';
import { IMPORT_OPERATIONS, IMPORT_ROUTES } from '../isolation/import-operations';
import type { BusinessWorld } from '../isolation/world-types';

const exchangeOf = (body: unknown): Exchange => ({
  request: { method: 'POST', path: '/admin-api', caller: { label: 'owner A' } },
  status: 200,
  body,
});

const SNAPSHOT_DATA = {
  catalogPack: { productId: 'T_1', price: 3150, weightGrams: 800, components: [] },
  catalogImport: { importId: '1', status: 'previewed', rowCount: 1, summary: {} },
  catalogImportPreview: { totalItems: 1, items: [] },
  catalogExport: { exportId: '2', status: 'done', rowCount: 1 },
  catalogLinkImport: { importId: '3', status: 'done', productId: 'T_2' },
};

describe('the P2 import snapshot (Task 12 review)', () => {
  it('keeps the data of a clean read', () => {
    // Act
    const snapshot = importSnapshotFrom(exchangeOf({ data: SNAPSHOT_DATA }), 'A');

    // Assert
    expect(snapshot).toEqual(SNAPSHOT_DATA);
  });

  it('throws on a GraphQL error, so two failed reads never compare equal', () => {
    // Arrange
    const failed = exchangeOf({ data: null, errors: [{ message: 'no', extensions: { code: 'FORBIDDEN' } }] });

    // Act
    const read = () => importSnapshotFrom(failed, 'A');

    // Assert
    expect(read).toThrow(/FORBIDDEN/);
  });

  it.each([
    ['no pack', { ...SNAPSHOT_DATA, catalogPack: null }],
    ['an import that is not previewed', { ...SNAPSHOT_DATA, catalogImport: { status: 'failed' } }],
  ])('throws on a read with %s, since it proves nothing about the rows', (_name, data) => {
    // Act
    const read = () => importSnapshotFrom(exchangeOf({ data }), 'A');

    // Assert
    expect(read).toThrow(/business A/);
  });
});

describe('the export cells naming B ids (Task 12 review)', () => {
  const attacker = {} as BusinessWorld;

  it.each([
    ['exportCatalogProducts', IMPORT_OPERATIONS.find((op) => op.name === 'exportCatalogProducts')?.foreign],
    [
      'POST /catalog/products/export',
      IMPORT_ROUTES.find((route) => `${route.method} ${route.route}` === 'POST /catalog/products/export')?.foreign,
    ],
  ])('%s requires a written, empty export, not a queued one', (_name, foreign) => {
    // Act
    const required = foreign?.kind === 'own' ? foreign.mustInclude(attacker) : [];

    // Assert
    expect(required).toEqual(expect.arrayContaining(['"status":"done"', '"rowCount":0']));
  });
});
