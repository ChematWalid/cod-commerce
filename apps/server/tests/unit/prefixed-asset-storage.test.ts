import { Readable } from 'node:stream';
import type { AssetStorageStrategy } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { PrefixedAssetStorage } from '../../src/config/prefixed-asset-storage';

/** A bucket in memory that, like S3, answers a write with the key it used. */
class MemoryBucket implements AssetStorageStrategy {
  readonly keys = new Map<string, Buffer>();

  writeFileFromBuffer(fileName: string, data: Buffer): Promise<string> {
    this.keys.set(fileName, data);
    return Promise.resolve(fileName);
  }

  writeFileFromStream(fileName: string): Promise<string> {
    return Promise.resolve(fileName);
  }

  readFileToBuffer(identifier: string): Promise<Buffer> {
    return Promise.resolve(this.keys.get(identifier) ?? Buffer.alloc(0));
  }

  readFileToStream(identifier: string): Promise<Readable> {
    return Promise.resolve(Readable.from([this.keys.get(identifier) ?? Buffer.alloc(0)]));
  }

  deleteFile(identifier: string): Promise<void> {
    this.keys.delete(identifier);
    return Promise.resolve();
  }

  fileExists(fileName: string): Promise<boolean> {
    return Promise.resolve(this.keys.has(fileName));
  }
}

describe('PrefixedAssetStorage', () => {
  it('writes under the prefix and hands back an identifier without it', async () => {
    // Arrange
    const bucket = new MemoryBucket();
    const storage = new PrefixedAssetStorage(bucket, 'assets/');

    // Act
    const identifier = await storage.writeFileFromBuffer('source/ab/logo.png', Buffer.from('x'));

    // Assert
    expect(identifier).toBe('source/ab/logo.png');
    expect([...bucket.keys.keys()]).toEqual(['assets/source/ab/logo.png']);
  });

  it('reads, checks and deletes through the same prefixed key', async () => {
    // Arrange
    const bucket = new MemoryBucket();
    const storage = new PrefixedAssetStorage(bucket, 'assets/');
    await storage.writeFileFromBuffer('source/ab/logo.png', Buffer.from('bytes'));

    // Act
    const read = await storage.readFileToBuffer('/source/ab/logo.png');
    const existed = await storage.fileExists('source/ab/logo.png');
    await storage.deleteFile('source/ab/logo.png');

    // Assert
    expect(read.toString()).toBe('bytes');
    expect(existed).toBe(true);
    expect(await storage.fileExists('source/ab/logo.png')).toBe(false);
  });
});
