import {
  Channel,
  ChannelService,
  type Injector,
  isGraphQlErrorResult,
  type RequestContext,
  TransactionalConnection,
  Zone,
} from '@vendure/core';
import {
  ALGERIA_ZONE_NAME,
  DEFAULT_CHANNEL_CODE,
  PLATFORM_CURRENCY,
  hasPlatformLanguages,
  PLATFORM_LANGUAGES,
  PRICES_INCLUDE_TAX,
  seedChange,
} from './seed.constants';

/** Vendure types the channel's zones as always set, but they are null on the channel it creates at first boot. */
const isZone = (actual: Zone | null | undefined, expected: Zone): boolean => actual?.id === expected.id;

const channelMatches = (channel: Channel, zone: Zone): boolean =>
  channel.defaultCurrencyCode === PLATFORM_CURRENCY &&
  channel.availableCurrencyCodes.length === 1 &&
  channel.availableCurrencyCodes[0] === PLATFORM_CURRENCY &&
  channel.pricesIncludeTax === PRICES_INCLUDE_TAX &&
  hasPlatformLanguages(channel.availableLanguageCodes) &&
  isZone(channel.defaultTaxZone, zone) &&
  isZone(channel.defaultShippingZone, zone);

/**
 * Ensures the default channel sells in DZD, tax-inclusive, offers the platform languages, and taxes and ships
 * by the zone "Algeria" (run after the zone).
 */
export async function ensureDefaultChannel(ctx: RequestContext, injector: Injector): Promise<string[]> {
  const connection = injector.get(TransactionalConnection);
  const zone = await connection.getRepository(ctx, Zone).findOneOrFail({ where: { name: ALGERIA_ZONE_NAME } });
  const channel = await connection.getRepository(ctx, Channel).findOneOrFail({
    where: { code: DEFAULT_CHANNEL_CODE },
    relations: { defaultTaxZone: true, defaultShippingZone: true },
  });
  if (channelMatches(channel, zone)) {
    return [];
  }
  const result = await injector.get(ChannelService).update(ctx, {
    id: channel.id,
    defaultCurrencyCode: PLATFORM_CURRENCY,
    availableCurrencyCodes: [PLATFORM_CURRENCY],
    pricesIncludeTax: PRICES_INCLUDE_TAX,
    availableLanguageCodes: [...PLATFORM_LANGUAGES],
    defaultTaxZoneId: zone.id,
    defaultShippingZoneId: zone.id,
  });
  if (isGraphQlErrorResult(result)) {
    throw new Error(`Cannot update the default channel: ${result.message}`);
  }
  return [seedChange('channel', DEFAULT_CHANNEL_CODE)];
}
