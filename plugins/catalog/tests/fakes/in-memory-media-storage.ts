import type { CoreId } from '../../domain/core-id';
import { MediaTypeError } from '../../domain/errors';
import type { ImageFormat } from '../../domain/image-format';
import type { ImageUpload, MediaRemoval, MediaStoragePort, StoredMedia } from '../../domain/ports/media-storage.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import { newCoreId } from '../support/builders';

/** The store a fake context stands for (see `storeContext`). */
const storeOf = (ctx: OperationContext): string => (ctx as unknown as { storeId: string }).storeId;

/**
 * The file store behind the media library, in memory: it keeps what it stored, which assets products use and which
 * store channels an asset was shared with.
 */
export class InMemoryMediaStorage implements MediaStoragePort {
  readonly files = new Map<CoreId, StoredMedia>();
  /** Formats in the order they were stored, so a test sees what the service sniffed. */
  readonly storedFormats: ImageFormat[] = [];
  /** Assets a product uses: removing one answers `in-use`. */
  readonly inUse = new Set<CoreId>();
  /** `<store>:<asset>` per share, in order. */
  readonly shares: string[] = [];
  /** When set, the next store fails like the content guard refusing an undecodable body. */
  refuseContent = false;

  store(_ctx: OperationContext, image: ImageUpload): Promise<StoredMedia> {
    if (this.refuseContent) return Promise.reject(new MediaTypeError());
    const assetId = newCoreId();
    const stored: StoredMedia = {
      assetId,
      url: `https://cdn.test/source/${assetId}.${image.format.extension}`,
      previewUrl: `https://cdn.test/preview/${assetId}.${image.format.extension}`,
      mimeType: image.format.mimeType,
      width: 1,
      height: 1,
      fileSize: image.bytes.length,
    };
    this.files.set(assetId, stored);
    this.storedFormats.push(image.format);
    return Promise.resolve(stored);
  }

  urlsOf(_ctx: OperationContext, assetIds: readonly CoreId[]): Promise<ReadonlyMap<CoreId, StoredMedia>> {
    const found = assetIds.flatMap((id) => {
      const file = this.files.get(id);
      return file === undefined ? [] : [[id, file] as const];
    });
    return Promise.resolve(new Map(found));
  }

  shareWithStore(ctx: OperationContext, assetIds: readonly CoreId[]): Promise<void> {
    for (const id of assetIds) this.shares.push(`${storeOf(ctx)}:${id}`);
    return Promise.resolve();
  }

  remove(_ctx: OperationContext, assetId: CoreId): Promise<MediaRemoval> {
    if (this.inUse.has(assetId)) return Promise.resolve('in-use');
    this.files.delete(assetId);
    return Promise.resolve('removed');
  }
}
