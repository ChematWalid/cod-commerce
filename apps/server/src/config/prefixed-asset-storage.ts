import type { Stream } from 'node:stream';
import type { AssetStorageStrategy, Injector } from '@vendure/core';

/**
 * Keeps a storage strategy's files under one key prefix. Asset identifiers (what the database holds and what the
 * asset route serves) stay prefix-free, so moving the files to another bucket or prefix later renames no row.
 */
export class PrefixedAssetStorage implements AssetStorageStrategy {
  readonly toAbsoluteUrl: AssetStorageStrategy['toAbsoluteUrl'];

  constructor(
    private readonly inner: AssetStorageStrategy,
    private readonly prefix: string,
  ) {
    this.toAbsoluteUrl = inner.toAbsoluteUrl?.bind(inner);
  }

  init(injector: Injector): Promise<void> | void {
    return this.inner.init?.(injector);
  }

  destroy(): Promise<void> | void {
    return this.inner.destroy?.();
  }

  async writeFileFromBuffer(fileName: string, data: Buffer): Promise<string> {
    return this.unprefixed(await this.inner.writeFileFromBuffer(this.prefixed(fileName), data));
  }

  async writeFileFromStream(fileName: string, data: Stream, encoding?: BufferEncoding | null): Promise<string> {
    return this.unprefixed(await this.inner.writeFileFromStream(this.prefixed(fileName), data, encoding));
  }

  readFileToBuffer(identifier: string): Promise<Buffer> {
    return this.inner.readFileToBuffer(this.prefixed(identifier));
  }

  readFileToStream(identifier: string, encoding?: BufferEncoding | null): Promise<Stream> {
    return this.inner.readFileToStream(this.prefixed(identifier), encoding);
  }

  deleteFile(identifier: string): Promise<void> {
    return this.inner.deleteFile(this.prefixed(identifier));
  }

  fileExists(fileName: string): Promise<boolean> {
    return this.inner.fileExists(this.prefixed(fileName));
  }

  private prefixed(identifier: string): string {
    return `${this.prefix}${identifier.replace(/^\//, '')}`;
  }

  private unprefixed(key: string): string {
    return key.startsWith(this.prefix) ? key.slice(this.prefix.length) : key;
  }
}
