import { Injectable } from '@nestjs/common';
import {
  Asset,
  Collection,
  type ID,
  Product,
  ProductAsset,
  ProductVariant,
  ProductVariantAsset,
  type RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { In, IsNull } from 'typeorm';
import type { CoreId } from '../domain/core-id';

/**
 * The asset reads `AssetService` has no channel-free form of (reviewed `RAW_DATA_ACCESS_FILES` entry, P2.S1 Task 13).
 * A media item may live in another store channel than the active one (D2132), and core's own usage check reads only
 * featured images, while a gallery image (`ProductAsset`) is a use too (D2128). Every asset id given here was found in
 * the caller's business's `catalog_media` first, so these reads never reach another business's file.
 */
@Injectable()
export class VendureAssetReads {
  constructor(private readonly connection: TransactionalConnection) {}

  /** The assets among `ids`, whichever channels hold them. */
  assetsByIds(ctx: RequestContext, ids: readonly CoreId[]): Promise<Asset[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.connection.getRepository(ctx, Asset).find({ where: { id: In([...ids]) } });
  }

  /** The channels holding the asset, or `undefined` when it no longer exists. */
  async channelIdsOf(ctx: RequestContext, id: CoreId): Promise<readonly ID[] | undefined> {
    const asset = await this.connection
      .getRepository(ctx, Asset)
      .findOne({ where: { id }, relations: { channels: true }, loadEagerRelations: false });
    return asset?.channels.map((channel) => channel.id);
  }

  /** Whether a live product or variant shows the asset (featured or in its gallery), or a collection features it. */
  async isInUse(ctx: RequestContext, id: CoreId): Promise<boolean> {
    const uses = [
      () =>
        this.connection.getRepository(ctx, Product).count({ where: { featuredAsset: { id }, deletedAt: IsNull() } }),
      () =>
        this.connection
          .getRepository(ctx, ProductAsset)
          .count({ where: { assetId: id, product: { deletedAt: IsNull() } } }),
      () =>
        this.connection
          .getRepository(ctx, ProductVariant)
          .count({ where: { featuredAsset: { id }, deletedAt: IsNull() } }),
      () =>
        this.connection
          .getRepository(ctx, ProductVariantAsset)
          .count({ where: { assetId: id, productVariant: { deletedAt: IsNull() } } }),
      () => this.connection.getRepository(ctx, Collection).count({ where: { featuredAsset: { id } } }),
    ];
    // One after another: they share the transaction's single connection.
    for (const count of uses) if ((await count()) > 0) return true;
    return false;
  }
}
