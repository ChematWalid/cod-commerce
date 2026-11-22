import type { DeliveryFeeGroup, DeliveryFeeGroupPage, DeliveryFeeGroupSummary } from '@cod/shared';
import type { FeeGroupHeader, FeeGroupPage, FeeGroupRecord } from '../domain/fee-group';
import { communeRateView, wilayaRateView } from '../domain/rate-view';

/** A group as the list shows it; dates as ISO 8601 text. */
export const toSummaryDto = (group: FeeGroupHeader): DeliveryFeeGroupSummary => ({
  id: group.id,
  name: group.name,
  carrierId: group.carrierId,
  isPlatformDefault: group.isPlatformDefault,
  createdAt: group.createdAt.toISOString(),
});

/** A page of the list. */
export const toPageDto = (page: FeeGroupPage): DeliveryFeeGroupPage => ({
  items: page.items.map(toSummaryDto),
  totalItems: page.totalItems,
});

/** A group with its effective wilaya rows and its commune rows (D3107, D3125), as both API surfaces answer it. */
export const toGroupDto = (group: FeeGroupRecord): DeliveryFeeGroup => ({
  id: group.id,
  name: group.name,
  carrierId: group.carrierId,
  chargeOverweight: group.chargeOverweight,
  overweightAllowanceKg: group.overweightAllowanceKg,
  overweightRate: group.overweightRate,
  isPlatformDefault: group.isPlatformDefault,
  createdAt: group.createdAt.toISOString(),
  updatedAt: group.updatedAt.toISOString(),
  rates: group.rates.map(wilayaRateView),
  communeRates: group.communeRates.map(communeRateView),
});
