import { describe, expect, it } from 'vitest';
import { importSourceKey } from '../../domain/object-keys';
import { garageObjectStorage } from '../../infrastructure/garage-object-storage';
import type { S3StorageOptions } from '../../infrastructure/plugin-options';
import { SCOPE } from '../support/scope';

// Offline signing only: no request leaves the test, so the credentials are plain labels.
const OPTIONS: S3StorageOptions = {
  kind: 's3',
  endpoint: 'http://garage:3900',
  publicEndpoint: 'http://localhost:3900',
  region: 'garage',
  forcePathStyle: true,
  bucket: 'cod-private',
  accessKeyId: 'synthetic-access-key-id',
  secretAccessKey: 'synthetic-secret-access-key',
};

describe('garageObjectStorage (D2208, D2250, D2279)', () => {
  it('signs an upload on the public endpoint with its size as a signed header and no checksum', async () => {
    // Arrange
    const storage = garageObjectStorage(OPTIONS);

    // Act
    const put = await storage.presignPut(importSourceKey(SCOPE, '7301'), {
      contentType: 'text/csv',
      size: 1234,
      ttlSeconds: 600,
    });

    // Assert
    const url = new URL(put.url);
    const query = [...url.searchParams.keys()].map((name) => name.toLowerCase());
    expect(url.origin).toBe('http://localhost:3900');
    expect(url.pathname.startsWith('/cod-private/uploads/')).toBe(true);
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host');
    expect(query.filter((name) => name.includes('checksum'))).toEqual([]);
  });
});
