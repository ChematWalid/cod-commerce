import { Injectable } from '@nestjs/common';
import {
  type Asset,
  AssetService,
  ChannelService,
  ConfigService,
  type RequestContext,
  RequestContextService,
} from '@vendure/core';
import type { AssetAccessPort } from '../domain/ports/asset-access.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { toRequestContext } from './operation-context.adapter';
import { shareTransaction } from './share-transaction';

/** {@link AssetAccessPort} on Vendure's `AssetService`, whose lookup is limited to the context's channel. */
@Injectable()
export class VendureAssetAccess implements AssetAccessPort {
  constructor(
    private readonly assets: AssetService,
    private readonly channels: ChannelService,
    private readonly contexts: RequestContextService,
    private readonly config: ConfigService,
  ) {}

  async isAssetInChannels(ctx: OperationContext, assetId: number, channelIds: readonly number[]): Promise<boolean> {
    return (await this.findInChannels(toRequestContext(ctx), assetId, channelIds)) !== undefined;
  }

  async previewUrlInChannels(
    ctx: OperationContext,
    assetId: number,
    channelIds: readonly number[],
  ): Promise<string | undefined> {
    const caller = toRequestContext(ctx);
    const asset = await this.findInChannels(caller, assetId, channelIds);
    return asset === undefined ? undefined : this.absoluteUrl(caller, asset.preview);
  }

  private async findInChannels(
    caller: RequestContext,
    assetId: number,
    channelIds: readonly number[],
  ): Promise<Asset | undefined> {
    const lookups = await Promise.all(channelIds.map((channelId) => this.findOnChannel(caller, channelId, assetId)));
    return lookups.find((asset) => asset !== undefined);
  }

  private async findOnChannel(caller: RequestContext, channelId: number, assetId: number): Promise<Asset | undefined> {
    const channel = await this.channels.findOne(caller, channelId);
    if (channel === undefined) return undefined;
    const onChannel = await this.contexts.create({ apiType: 'admin', channelOrToken: channel });
    return this.assets.findOne(shareTransaction(caller, onChannel), assetId);
  }

  /** The URL the storage strategy gives every asset, so it follows the asset server's route and host. */
  private absoluteUrl(ctx: RequestContext, identifier: string): string {
    const storage = this.config.assetOptions.assetStorageStrategy;
    return storage.toAbsoluteUrl === undefined || ctx.req === undefined
      ? identifier
      : storage.toAbsoluteUrl(ctx.req, identifier);
  }
}
