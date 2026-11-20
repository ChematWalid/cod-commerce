import { Readable } from 'node:stream';
import { CATALOG_IMPORT_ERROR_CODES } from '@cod/shared';
import type { FactoryProvider } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import type { ObjectStorage } from '../../application/ports/object-storage.port';
import { OBJECT_STORAGE } from '../../application/tokens';
import { CatalogImportPlugin } from '../../catalog-import.plugin';
import { exportFileKey, importSourceKey } from '../../domain/object-keys';
import { MemoryObjectStorage } from '../../infrastructure/memory-object-storage';
import { clearCatalogImportOptions } from '../../infrastructure/plugin-options';
import { CATALOG_IMPORT_PROVIDERS } from '../../infrastructure/providers';
import { bytesOf, SCOPE } from '../support/scope';

/** What the `OBJECT_STORAGE` token resolves to, built by the plugin's own provider. */
function objectStorageFromToken(): ObjectStorage {
  const provider = CATALOG_IMPORT_PROVIDERS.find(
    (candidate): candidate is FactoryProvider<ObjectStorage> =>
      typeof candidate === 'object' && 'provide' in candidate && candidate.provide === OBJECT_STORAGE,
  );
  if (provider === undefined) throw new Error('no OBJECT_STORAGE provider');
  return provider.useFactory() as ObjectStorage;
}

const NOW = new Date('2026-11-15T10:00:00.000Z');
const C = CATALOG_IMPORT_ERROR_CODES;

describe('MemoryObjectStorage (D2208)', () => {
  afterEach(() => {
    clearCatalogImportOptions();
  });

  it('presign returns an opaque memory:// URL', async () => {
    // Arrange
    const storage = new MemoryObjectStorage(() => NOW);
    const key = importSourceKey(SCOPE, '7301');

    // Act
    const put = await storage.presignPut(key, { contentType: 'text/csv', size: 12, ttlSeconds: 600 });
    const get = await storage.presignGet(exportFileKey(SCOPE, '7302'), {
      ttlSeconds: 300,
      downloadName: 'products-7302.csv',
      contentType: 'text/csv',
    });

    // Assert
    expect(new URL(put.url).protocol).toBe('memory:');
    expect(put).toMatchObject({
      method: 'PUT',
      headers: { 'content-type': 'text/csv', 'content-length': '12' },
      expiresAt: new Date('2026-11-15T10:10:00.000Z'),
    });
    expect(put.url).toContain(key);
    expect(new URL(get).protocol).toBe('memory:');
  });

  it('tests reach bytes only through the DI token', async () => {
    // Arrange: memory storage configured, the instance the OBJECT_STORAGE provider builds is the only way in and out
    CatalogImportPlugin.init({ objectStorage: { kind: 'memory' }, linkScraper: 'fixture', appEnv: 'test' });
    const storage = objectStorageFromToken();
    expect(storage).toBeInstanceOf(MemoryObjectStorage);
    const key = importSourceKey(SCOPE, '7301');
    await storage.write(key, bytesOf('name,price\n'), 'text/csv');
    const head = await storage.head(key);

    // Act
    const bytes = await storage.read(key, { maxBytes: 100, ifMatch: head?.etag ?? '' });

    // Assert
    expect(head).toMatchObject({ size: 11, contentType: 'text/csv' });
    expect(new TextDecoder().decode(bytes)).toBe('name,price\n');
    await expect(storage.read(key, { maxBytes: 100, ifMatch: '"other"' })).rejects.toMatchObject({
      code: C.JOB_STATE,
    });
    await expect(storage.read(key, { maxBytes: 10, ifMatch: head?.etag ?? '' })).rejects.toMatchObject({
      code: C.FILE_TOO_LARGE,
    });
  });

  it('a re-written object gets a new ETag, and a deleted one has no head', async () => {
    // Arrange
    const storage = new MemoryObjectStorage(() => NOW);
    const key = importSourceKey(SCOPE, '7301');
    await storage.write(key, bytesOf('a'), 'text/csv');
    const first = await storage.head(key);

    // Act
    await storage.write(key, bytesOf('b'), 'text/csv');
    const second = await storage.head(key);
    await storage.delete(key);

    // Assert
    expect(second?.etag).not.toBe(first?.etag);
    expect(await storage.head(key)).toBeNull();
  });

  it('writes a streamed body', async () => {
    // Arrange
    const storage = new MemoryObjectStorage(() => NOW);
    const key = exportFileKey(SCOPE, '7302');
    const chunks = (): AsyncIterable<Uint8Array> => Readable.from([bytesOf('ab'), bytesOf('cd')]);

    // Act
    await storage.write(key, chunks(), 'text/csv');

    // Assert
    expect(await storage.head(key)).toMatchObject({ size: 4 });
  });

  it('presignPut refuses a key outside uploads/', async () => {
    // Arrange
    const storage = new MemoryObjectStorage(() => NOW);

    // Act and Assert
    await expect(
      storage.presignPut(exportFileKey(SCOPE, '7302'), { contentType: 'text/csv', size: 12, ttlSeconds: 600 }),
    ).rejects.toMatchObject({ code: C.INVALID_INPUT });
  });

  it('presignGet refuses a key outside exports/', async () => {
    // Arrange
    const storage = new MemoryObjectStorage(() => NOW);

    // Act and Assert
    await expect(
      storage.presignGet(importSourceKey(SCOPE, '7301'), {
        ttlSeconds: 300,
        downloadName: 'x.csv',
        contentType: 'text/csv',
      }),
    ).rejects.toMatchObject({ code: C.INVALID_INPUT });
  });
});
