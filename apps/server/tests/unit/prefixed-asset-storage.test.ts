import { posix } from 'node:path';
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

  describe('key pinning', () => {
    const cases: Array<[label: string, identifier: string, key: string]> = [
      ['parent segment', '../x', 'assets/x'],
      ['parent segments that climb past the root', 'a/../../x', 'assets/x'],
      ['absolute path', '/etc/passwd', 'assets/etc/passwd'],
      ['backslash parent segment', '..\\x', 'assets/x'],
      ['percent-encoded parent segment', '%2e%2e/x', 'assets/x'],
      ['empty string', '', 'assets/'],
      ['normal name', 'source/ab/logo.png', 'assets/source/ab/logo.png'],
    ];

    it.each(cases)('keeps a %s inside the prefix', async (_label, identifier, key) => {
      // Arrange
      const bucket = new MemoryBucket();
      const storage = new PrefixedAssetStorage(bucket, 'assets/');
      const seen: string[] = [];
      for (const method of ['writeFileFromBuffer', 'readFileToBuffer', 'readFileToStream', 'deleteFile', 'fileExists'] as const) {
        const original = bucket[method].bind(bucket) as (k: string, ...rest: unknown[]) => Promise<unknown>;
        (bucket as unknown as Record<string, unknown>)[method] = (k: string, ...rest: unknown[]) => {
          seen.push(k);
          return original(k, ...rest);
        };
      }

      // Act
      await storage.writeFileFromBuffer(identifier, Buffer.from('x'));
      await storage.readFileToBuffer(identifier);
      await storage.readFileToStream(identifier);
      await storage.fileExists(identifier);
      await storage.deleteFile(identifier);

      // Assert
      const keys = seen;
      expect(keys).toHaveLength(5);
      for (const used of keys) {
        expect(used.startsWith('assets/')).toBe(true);
        expect(used).toBe(key);
        expect(used.split('/')).not.toContain('..');
        expect(posix.normalize(used)).toBe(used === 'assets/' ? 'assets/' : used);
      }
    });
  });
});
