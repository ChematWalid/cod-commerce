import { isSnowflake, MEDIA_MAX_BYTES } from '@cod/shared';
import { MediaInUseError, MediaNotFoundError, MediaTooLargeError, MediaTypeError } from '../domain/errors';
import { detectImageFormat } from '../domain/image-format';
import type { MediaItem } from '../domain/media-item';
import type { MediaPage } from '../domain/ports/media-repository.port';
import type { StoredMedia } from '../domain/ports/media-storage.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { ProductPorts } from './catalog-ports';
import { mediaReachOf } from './media-reach';

/** One image of the library as both API surfaces answer it. */
export interface MediaView extends Omit<StoredMedia, 'assetId'> {
  readonly id: MediaItem['id'];
  readonly assetId: MediaItem['assetId'];
  readonly createdAt: Date;
}

/** One page of the library and how many images match in all. */
export interface MediaViewPage {
  readonly items: readonly MediaView[];
  readonly totalItems: number;
}

const viewOf = (item: MediaItem, file: StoredMedia): MediaView => ({
  ...file,
  id: item.id,
  assetId: item.assetId,
  createdAt: item.createdAt,
});

/**
 * The business's media library (D2113, D2132): upload an image in the active store, list the images of the stores
 * the caller reaches, delete one no product uses (D2128). The format is read from the bytes, never from the client's
 * name or type; a refusal stores nothing.
 */
export class MediaLibraryService {
  constructor(private readonly ports: ProductPorts) {}

  /**
   * @throws {MediaTooLargeError} past `MEDIA_MAX_BYTES` (the caller reads one byte more to tell).
   * @throws {MediaTypeError} for anything but a PNG, JPEG, GIF or WebP image, an empty file included.
   */
  async upload(ctx: OperationContext, scope: StoreScope, bytes: Uint8Array): Promise<MediaView> {
    if (bytes.length > MEDIA_MAX_BYTES) throw new MediaTooLargeError();
    const format = detectImageFormat(bytes);
    if (format === undefined) throw new MediaTypeError();
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      const file = await this.ports.storage.store(tx, { bytes, format });
      const item: MediaItem = {
        id: this.ports.ids.next(),
        businessId: scope.businessId,
        storeId: scope.storeId,
        assetId: file.assetId,
        createdAt: this.ports.clock.now(),
      };
      await this.ports.media.insert(tx, scope, item);
      return viewOf(item, file);
    });
  }

  /**
   * One page of the images of the stores the caller reaches, newest first. `totalItems` counts media rows, an image
   * whose asset is gone included, though the page leaves that one out.
   */
  async list(ctx: OperationContext, scope: StoreScope, page: MediaPage): Promise<MediaViewPage> {
    const reach = await mediaReachOf(this.ports.orderManagers, ctx, scope);
    const { items, totalItems } = await this.ports.media.list(ctx, scope, reach, page);
    const files = await this.ports.storage.urlsOf(
      ctx,
      items.map((item) => item.assetId),
    );
    // An image whose asset is gone (removed outside the catalog, e.g. by a platform admin) has nothing to show; its row
    // still counts in `totalItems`, so such a page holds fewer items than `take`. Paging by `skip` stays stable.
    const views = items.flatMap((item) => {
      const file = files.get(item.assetId);
      return file === undefined ? [] : [viewOf(item, file)];
    });
    return { items: views, totalItems };
  }

  /**
   * @throws {MediaNotFoundError} for a malformed id, another business's, or one of a store the caller does not reach.
   * @throws {MediaInUseError} while a product, variant or collection of any store uses the image, featured or in its
   *   gallery (D2128); a save naming the image in flight is waited for.
   */
  async delete(ctx: OperationContext, scope: StoreScope, rawId: string): Promise<void> {
    if (!isSnowflake(rawId)) throw new MediaNotFoundError();
    const reach = await mediaReachOf(this.ports.orderManagers, ctx, scope);
    await this.ports.transaction.run(ctx, scope, async (tx) => {
      const item = await this.ports.media.findById(tx, scope, reach, rawId);
      if (item === undefined) throw new MediaNotFoundError();
      // Waits for every save that names the image and holds back later ones, so the in-use check sees them (D2128).
      await this.ports.mediaLock.exclusive(tx, item.assetId);
      if ((await this.ports.storage.remove(tx, item.assetId)) === 'in-use') throw new MediaInUseError();
      await this.ports.media.delete(tx, scope, reach, item.id);
    });
  }
}
