import { Injectable } from '@nestjs/common';
import { AssetService, ChannelService, type RequestContext, RequestContextService } from '@vendure/core';
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
  ) {}

  async isAssetInChannels(ctx: OperationContext, assetId: number, channelIds: readonly number[]): Promise<boolean> {
    const caller = toRequestContext(ctx);
    const lookups = await Promise.all(channelIds.map((channelId) => this.holdsAsset(caller, channelId, assetId)));
    return lookups.includes(true);
  }

  private async holdsAsset(caller: RequestContext, channelId: number, assetId: number): Promise<boolean> {
    const channel = await this.channels.findOne(caller, channelId);
    if (channel === undefined) return false;
    const onChannel = await this.contexts.create({ apiType: 'admin', channelOrToken: channel });
    const asset = await this.assets.findOne(shareTransaction(caller, onChannel), assetId);
    return asset !== undefined;
  }
}
