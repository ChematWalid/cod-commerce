import { Injectable } from '@nestjs/common';
import {
  type Asset,
  AssetService,
  ChannelService,
  Collection,
  CollectionService,
  ConfigService,
  idsAreEqual,
  type RequestContext,
} from '@vendure/core';
import type { OperationContext } from '../domain/ports/operation-context';
import type {
  CollectionImage,
  CollectionMeta,
  CollectionTexts,
  NewVendureCollection,
  VendureCollectionPatch,
  VendureCollectionsPort,
} from '../domain/ports/vendure-collections.port';
import { toRequestContext } from './request-scope';
import { storedSlug } from './stored-slug';

/** A core id as Vendure's own entities hold it: the integer of its SERIAL column (D2159). */
const engineIdOf = (id: string): number => Number(id);

/**
 * Vendure clears a featured image on `null` (`AssetService.updateFeaturedAsset`), but its generated input types leave
 * `null` out; this keeps the clear without widening the type everywhere.
 */
const clearableId = (id: string | null): number | undefined =>
  id === null ? (null as unknown as undefined) : engineIdOf(id);

/** The one translation a collection is written in: the store channel's language (D2112). */
function translationOf(ctx: RequestContext, texts: CollectionTexts) {
  return {
    languageCode: ctx.channel.defaultLanguageCode,
    name: texts.title,
    slug: storedSlug(texts.slug),
    description: texts.description ?? '',
  };
}

/**
 * {@link VendureCollectionsPort} on Vendure's `CollectionService` in the active (store) channel. A new collection has
 * no filter (D2301) and sits under the shared root; Vendure also joins it to the default channel, which it leaves in
 * the same transaction (D2333, the catalog's `DefaultChannelExit` pattern).
 */
@Injectable()
export class VendureCollectionsAdapter implements VendureCollectionsPort {
  constructor(
    private readonly collections: CollectionService,
    private readonly channels: ChannelService,
    private readonly assets: AssetService,
    private readonly config: ConfigService,
  ) {}

  async create(ctx: OperationContext, collection: NewVendureCollection): Promise<string> {
    const request = toRequestContext(ctx);
    const created = await this.collections.create(request, {
      isPrivate: collection.isPrivate,
      ...(collection.featuredAssetId === null ? {} : { featuredAssetId: engineIdOf(collection.featuredAssetId) }),
      filters: [],
      translations: [translationOf(request, collection)],
    });
    await this.leaveDefaultChannel(request, created.id);
    return String(created.id);
  }

  async update(ctx: OperationContext, collectionId: string, patch: VendureCollectionPatch): Promise<void> {
    const request = toRequestContext(ctx);
    await this.collections.update(request, {
      id: engineIdOf(collectionId),
      ...(patch.isPrivate === undefined ? {} : { isPrivate: patch.isPrivate }),
      ...(patch.featuredAssetId === undefined ? {} : { featuredAssetId: clearableId(patch.featuredAssetId) }),
      ...(patch.texts === undefined ? {} : { translations: [translationOf(request, patch.texts)] }),
    });
  }

  async delete(ctx: OperationContext, collectionId: string): Promise<void> {
    await this.collections.delete(toRequestContext(ctx), engineIdOf(collectionId));
  }

  async findMany(
    ctx: OperationContext,
    collectionIds: readonly string[],
  ): Promise<ReadonlyMap<string, CollectionMeta>> {
    if (collectionIds.length === 0) return new Map();
    const request = toRequestContext(ctx);
    const found = await this.collections.findByIds(request, collectionIds.map(engineIdOf), ['featuredAsset']);
    return new Map(found.map((collection) => [String(collection.id), this.metaOf(request, collection)]));
  }

  storedSlugOf(slug: string): string {
    return storedSlug(slug);
  }

  async slugTaken(ctx: OperationContext, slug: string, exceptId?: string): Promise<boolean> {
    const holder = await this.collections.findOneBySlug(toRequestContext(ctx), storedSlug(slug), []);
    return holder !== undefined && String(holder.id) !== exceptId;
  }

  async assetExists(ctx: OperationContext, assetId: string): Promise<boolean> {
    return (await this.assets.findOne(toRequestContext(ctx), engineIdOf(assetId))) !== undefined;
  }

  private async leaveDefaultChannel(ctx: RequestContext, collectionId: Collection['id']): Promise<void> {
    const defaultChannel = await this.channels.getDefaultChannel(ctx);
    if (idsAreEqual(ctx.channelId, defaultChannel.id)) return;
    await this.channels.removeFromChannels(ctx, Collection, collectionId, [defaultChannel.id]);
  }

  private metaOf(ctx: RequestContext, collection: Collection): CollectionMeta {
    const description = collection.description === '' ? null : collection.description;
    return { title: collection.name, slug: collection.slug, description, featuredAsset: this.imageOf(ctx, collection) };
  }

  /** The image with the URL the storage strategy gives every asset, as the catalog's media library answers it. */
  private imageOf(ctx: RequestContext, collection: Collection): CollectionImage | null {
    // An unloaded or cleared relation reads as nothing, whatever the entity's type says.
    const asset = collection.featuredAsset as Asset | null | undefined;
    if (asset === null || asset === undefined) return null;
    const storage = this.config.assetOptions.assetStorageStrategy;
    const preview =
      storage.toAbsoluteUrl === undefined || ctx.req === undefined
        ? asset.preview
        : storage.toAbsoluteUrl(ctx.req, asset.preview);
    return { id: String(asset.id), preview };
  }
}
