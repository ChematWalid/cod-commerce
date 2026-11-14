import { Readable } from 'node:stream';
import { AUTH_ERROR_CODES } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { DeletionResult } from '@vendure/common/lib/generated-types';
import {
  Asset,
  AssetService,
  ChannelService,
  ConfigService,
  EntityNotFoundError,
  idsAreEqual,
  isGraphQlErrorResult,
  type RequestContext,
} from '@vendure/core';
import type { CoreId } from '../domain/core-id';
import { MediaNotFoundError, MediaTypeError } from '../domain/errors';
import type { ImageUpload, MediaRemoval, MediaStoragePort, StoredMedia } from '../domain/ports/media-storage.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { toRequestContext } from './request-scope';
import { VendureAssetReads } from './vendure-asset-reads';
import { coreIdOf } from './vendure-product-mapper';

/** The name every stored media file starts with; the extension comes from the sniffed format, never the client. */
const MEDIA_FILE_STEM = 'media';

/**
 * Auth's content guard refuses a body that does not decode, or is over 40 megapixels, with this code (copied from
 * `plugins/auth/infrastructure/vendure-logo-assets.ts`, matched by code: auth's internals are not imported).
 */
function refusedAsMediaType(error: unknown): never {
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  throw code === AUTH_ERROR_CODES.IMAGE_TYPE ? new MediaTypeError() : error;
}

/**
 * {@link MediaStoragePort} on Vendure's `AssetService` and the configured asset storage (D2113). The file is described
 * by what its bytes are, so core's own type check and the content guard see the detected format.
 */
@Injectable()
export class VendureMediaStorage implements MediaStoragePort {
  constructor(
    private readonly assets: AssetService,
    private readonly channels: ChannelService,
    private readonly config: ConfigService,
    private readonly reads: VendureAssetReads,
  ) {}

  async store(ctx: OperationContext, { bytes, format }: ImageUpload): Promise<StoredMedia> {
    const request = toRequestContext(ctx);
    const upload = {
      filename: `${MEDIA_FILE_STEM}.${format.extension}`,
      mimetype: format.mimeType,
      encoding: '7bit',
      createReadStream: () => Readable.from([Buffer.from(bytes)], { objectMode: false }),
    };
    const created = await this.assets.create(request, { file: Promise.resolve(upload) }).catch(refusedAsMediaType);
    if (isGraphQlErrorResult(created)) throw new MediaTypeError();
    await this.leaveDefaultChannel(request, created.id);
    return this.storedOf(request, created);
  }

  async urlsOf(ctx: OperationContext, assetIds: readonly CoreId[]): Promise<ReadonlyMap<CoreId, StoredMedia>> {
    const request = toRequestContext(ctx);
    const assets = await this.reads.assetsByIds(request, assetIds);
    return new Map(assets.map((asset) => [coreIdOf(asset.id), this.storedOf(request, asset)]));
  }

  async shareWithStore(ctx: OperationContext, assetIds: readonly CoreId[]): Promise<void> {
    const request = toRequestContext(ctx);
    for (const id of assetIds) await this.joinStore(request, id);
  }

  /** A media row can outlive its asset when a platform admin deleted it outside the catalog: that image is gone. */
  private async joinStore(request: RequestContext, assetId: CoreId): Promise<void> {
    try {
      await this.channels.assignToChannels(request, Asset, assetId, [request.channelId]);
    } catch (error: unknown) {
      if (error instanceof EntityNotFoundError) throw new MediaNotFoundError();
      throw error;
    }
  }

  /**
   * Core deletes an asset only from the active channel and keeps the file while another channel holds it, so the
   * asset first joins the active channel and leaves every other one; then core deletes the row and the file on
   * commit. Core's usage check reads featured images only: ours runs first (D2128).
   */
  async remove(ctx: OperationContext, assetId: CoreId): Promise<MediaRemoval> {
    const request = toRequestContext(ctx);
    if (await this.reads.isInUse(request, assetId)) return 'in-use';
    const channelIds = await this.reads.channelIdsOf(request, assetId);
    if (channelIds === undefined) return 'removed';
    await this.channels.assignToChannels(request, Asset, assetId, [request.channelId]);
    const others = channelIds.filter((id) => !idsAreEqual(id, request.channelId));
    if (others.length > 0) await this.channels.removeFromChannels(request, Asset, assetId, others);
    const deleted = await this.assets.delete(request, [assetId], true);
    if (deleted.result !== DeletionResult.DELETED) throw new Error('Core kept a media asset it was asked to delete');
    return 'removed';
  }

  /** Core also puts a new asset on the default channel; a business's media belongs to its store channels only. */
  private async leaveDefaultChannel(ctx: RequestContext, assetId: Asset['id']): Promise<void> {
    const defaultChannel = await this.channels.getDefaultChannel(ctx);
    if (idsAreEqual(defaultChannel.id, ctx.channelId)) return;
    await this.channels.removeFromChannels(ctx, Asset, assetId, [defaultChannel.id]);
  }

  private storedOf(ctx: RequestContext, asset: Asset): StoredMedia {
    return {
      assetId: coreIdOf(asset.id),
      url: this.absoluteUrl(ctx, asset.source),
      previewUrl: this.absoluteUrl(ctx, asset.preview),
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      fileSize: asset.fileSize,
    };
  }

  /** The same URL the storage strategy gives every asset, so it follows the asset server's route and host. */
  private absoluteUrl(ctx: RequestContext, identifier: string): string {
    const storage = this.config.assetOptions.assetStorageStrategy;
    return storage.toAbsoluteUrl === undefined || ctx.req === undefined
      ? identifier
      : storage.toAbsoluteUrl(ctx.req, identifier);
  }
}
