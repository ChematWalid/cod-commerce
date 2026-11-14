import type { Readable } from 'node:stream';
import { MEDIA_MAX_BYTES, mediaListQuerySchema } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import { MediaLibraryService, type MediaView, type MediaViewPage } from '../application/media-library.service';
import { InvalidCatalogInputError } from '../domain/errors';
import { asOperationContext } from '../domain/ports/operation-context';
import { readAtMost } from './read-upload';
import { idArgOf, parseInput } from './request-body';
import { scopeOf } from './store-scope-of';

/** One image of the library as both API surfaces answer it (`CatalogMedia`). */
export interface CatalogMediaDto {
  readonly id: string;
  readonly assetId: string;
  readonly url: string;
  readonly previewUrl: string;
  readonly mimeType: string;
  readonly width: number;
  readonly height: number;
  readonly fileSize: number;
  readonly createdAt: Date;
}

/** One page of the library (`CatalogMediaList`). */
export interface CatalogMediaListDto {
  readonly items: readonly CatalogMediaDto[];
  readonly totalItems: number;
}

/** What the `Upload` scalar resolves to: only the stream is read, never the client's name or type. */
interface FileUpload {
  readonly createReadStream: () => Readable;
}

const isFileUpload = (value: unknown): value is FileUpload =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { createReadStream?: unknown }).createReadStream === 'function';

const toDto = ({ id, assetId, url, previewUrl, mimeType, width, height, fileSize, createdAt }: MediaView) => ({
  id,
  assetId,
  url,
  previewUrl,
  mimeType,
  width,
  height,
  fileSize,
  createdAt,
});

const toListDto = (page: MediaViewPage): CatalogMediaListDto => ({
  items: page.items.map(toDto),
  totalItems: page.totalItems,
});

/** One path per media action for both API surfaces (team pattern); resolvers and controllers add error mapping. */
@Injectable()
export class MediaActions {
  constructor(private readonly library: MediaLibraryService) {}

  /** Reads at most one byte past the limit, so a larger file is told apart without being held whole (D2113). */
  async upload(ctx: RequestContext, file: unknown): Promise<CatalogMediaDto> {
    const upload: unknown = await file;
    if (!isFileUpload(upload)) throw new InvalidCatalogInputError();
    const bytes = await readAtMost(upload.createReadStream(), MEDIA_MAX_BYTES + 1);
    return toDto(await this.library.upload(asOperationContext(ctx), scopeOf(ctx), bytes));
  }

  async list(ctx: RequestContext, options: unknown): Promise<CatalogMediaListDto> {
    const page = parseInput(mediaListQuerySchema, options);
    return toListDto(await this.library.list(asOperationContext(ctx), scopeOf(ctx), page));
  }

  async delete(ctx: RequestContext, id: unknown): Promise<void> {
    await this.library.delete(asOperationContext(ctx), scopeOf(ctx), idArgOf(id));
  }
}
