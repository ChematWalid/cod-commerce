import { Injectable } from '@nestjs/common';
import {
  ChannelService,
  idsAreEqual,
  Product,
  ProductOption,
  ProductOptionGroup,
  ProductVariant,
  type RequestContext,
} from '@vendure/core';
import type { CoreId } from '../domain/core-id';
import type { ProductRecord } from '../domain/product';

/**
 * Vendure joins every product, variant, option group and option to the default channel as well as the store's
 * (research `vendure.md` §0.5). A business's catalog must not show there (D2133), so every save takes its rows out
 * of the default channel in the same transaction.
 */
@Injectable()
export class DefaultChannelExit {
  constructor(private readonly channels: ChannelService) {}

  async leave(ctx: RequestContext, record: ProductRecord): Promise<void> {
    const defaultChannel = await this.channels.getDefaultChannel(ctx);
    if (idsAreEqual(ctx.channelId, defaultChannel.id)) return;
    const away = [defaultChannel.id];
    await this.channels.removeFromChannels(ctx, Product, record.id, away);
    for (const variant of record.variants)
      await this.channels.removeFromChannels(ctx, ProductVariant, variant.id, away);
    for (const group of record.optionGroups) {
      await this.channels.removeFromChannels(ctx, ProductOptionGroup, group.id, away);
      for (const value of group.values) await this.removeOption(ctx, value.id, away);
    }
  }

  private async removeOption(ctx: RequestContext, optionId: CoreId, away: readonly (string | number)[]): Promise<void> {
    await this.channels.removeFromChannels(ctx, ProductOption, optionId, [...away]);
  }
}
