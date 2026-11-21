import { afterEach, describe, expect, it } from 'vitest';
import { CatalogImportPlugin } from '../../catalog-import.plugin';
import { MemoryObjectStorage } from '../../infrastructure/memory-object-storage';
import {
  type CatalogImportPluginOptions,
  clearCatalogImportOptions,
  requireCatalogImportOptions,
} from '../../infrastructure/plugin-options';
import { objectStorageOf } from '../../infrastructure/providers';
import { S3ObjectStorage } from '../../infrastructure/s3-object-storage';

const S3 = {
  kind: 's3',
  endpoint: 'http://garage:3900',
  publicEndpoint: 'https://files.example.test',
  region: 'garage',
  forcePathStyle: true,
  bucket: 'cod-private',
  // Labels only: the unit tests never reach a server.
  accessKeyId: 'synthetic-access-key-id',
  secretAccessKey: 'synthetic-secret-access-key',
} as const;

const options = (overrides: Partial<CatalogImportPluginOptions> = {}): CatalogImportPluginOptions => ({
  objectStorage: S3,
  linkScraper: 'http',
  appEnv: 'production',
  ...overrides,
});

describe('CatalogImportPlugin options (D2208, D2214)', () => {
  afterEach(() => {
    clearCatalogImportOptions();
  });

  it('refuses memory storage in production', () => {
    // Act and Assert
    expect(() => CatalogImportPlugin.init(options({ objectStorage: { kind: 'memory' } }))).toThrow(/memory/);
    expect(() =>
      CatalogImportPlugin.init(options({ objectStorage: { kind: 'memory' }, appEnv: 'test' })),
    ).not.toThrow();
  });

  it('refuses the fixture scraper in production', () => {
    // Act and Assert
    expect(() => CatalogImportPlugin.init(options({ linkScraper: 'fixture' }))).toThrow(/fixture/);
    expect(() => CatalogImportPlugin.init(options({ linkScraper: 'fixture', appEnv: 'development' }))).not.toThrow();
  });

  it('options are read lazily after a second init', () => {
    // Arrange: the app registers S3; the integration config then re-calls init with memory storage (D2208)
    CatalogImportPlugin.init(options({ appEnv: 'test' }));
    CatalogImportPlugin.init(options({ objectStorage: { kind: 'memory' }, linkScraper: 'fixture', appEnv: 'test' }));

    // Act
    const storage = objectStorageOf(requireCatalogImportOptions());

    // Assert
    expect(requireCatalogImportOptions().linkScraper).toBe('fixture');
    expect(storage).toBeInstanceOf(MemoryObjectStorage);
    expect(objectStorageOf(options())).toBeInstanceOf(S3ObjectStorage);
  });

  it('refuses to build a provider before init', () => {
    // Act and Assert
    expect(() => requireCatalogImportOptions()).toThrow(/CatalogImportPlugin.init/);
  });
});
