import type { CoreId } from '../core-id';
import type { ImageFormat } from '../image-format';
import type { OperationContext } from './operation-context';

/** An image whose format was read from its bytes, ready to store. */
export interface ImageUpload {
  readonly bytes: Uint8Array;
  readonly format: ImageFormat;
}

/** A stored image as the media library answers it: its asset, its two URLs and what it is. */
export interface StoredMedia {
  readonly assetId: CoreId;
  readonly url: string;
  readonly previewUrl: string;
  readonly mimeType: string;
  readonly width: number;
  readonly height: number;
  readonly fileSize: number;
}

/** What removing a stored image did: removed it, or left it because a product still uses it (D2128). */
export type MediaRemoval = 'removed' | 'in-use';

/**
 * Where the media library keeps its files (D2113): Vendure's assets on the configured storage now, a CDN adapter
 * later. Every call joins the transaction `ctx` carries.
 */
export interface MediaStoragePort {
  /**
   * Stores `image` in the store channel of `ctx`, and nowhere else.
   *
   * @throws {MediaTypeError} when the storage refuses the content (a body that does not decode, too many pixels).
   */
  store(ctx: OperationContext, image: ImageUpload): Promise<StoredMedia>;

  /** The stored images among `assetIds`, whichever store channel holds them; a missing one is left out. */
  urlsOf(ctx: OperationContext, assetIds: readonly CoreId[]): Promise<ReadonlyMap<CoreId, StoredMedia>>;

  /**
   * Makes each image usable by products of the store channel of `ctx` (a media item of another store, D2132).
   *
   * @throws {MediaNotFoundError} when an image's asset is gone although its media row remains.
   */
  shareWithStore(ctx: OperationContext, assetIds: readonly CoreId[]): Promise<void>;

  /**
   * Removes an image from every store channel and the storage, unless a live product or variant, or a collection,
   * uses it as its featured image or in its gallery (D2128).
   */
  remove(ctx: OperationContext, assetId: CoreId): Promise<MediaRemoval>;
}
