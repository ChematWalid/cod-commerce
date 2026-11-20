import type { SkipReason } from '@cod/shared';
import { deliveryMethodOf, type PricingCart } from '../cart';
import { FIRST_ORDER_COUNT } from '../constants';
import type { Offer } from '../offer';
import type { PricingSnapshot } from '../snapshot';
import { checkUsageLimits } from './limits';
import { isInSchedule } from './schedule';

/** One eligibility rule: the reason it refuses the offer, or `null`. */
type EligibilityRule = (offer: Offer, cart: PricingCart, snapshot: PricingSnapshot) => SkipReason | null;

const channelRule: EligibilityRule = ({ eligibility }, cart) =>
  eligibility.channels.length === 0 || eligibility.channels.includes(cart.channel) ? null : 'channel';

/** A wilaya-limited offer needs a destination in one of its wilayas; no destination fails it. */
const wilayaRule: EligibilityRule = ({ eligibility }, { destination }) => {
  if (eligibility.wilayas.length === 0) return null;
  return destination !== null && eligibility.wilayas.includes(destination.provinceCode) ? null : 'wilaya';
};

/** A method-limited offer needs a destination delivered by one of its methods; no destination fails it. */
const deliveryMethodRule: EligibilityRule = ({ eligibility }, { destination }) => {
  if (eligibility.deliveryMethods.length === 0) return null;
  const method = deliveryMethodOf(destination);
  return method !== null && eligibility.deliveryMethods.includes(method) ? null : 'delivery_method';
};

/** `first` wants a buyer without orders, `returning` one with orders; both need a phone (D2418). */
const audienceRule: EligibilityRule = ({ eligibility }, cart, { buyerOrderCount }) => {
  if (eligibility.audience === 'everyone') return null;
  if (cart.buyer === null || buyerOrderCount === null) return 'audience';
  const isFirst = buyerOrderCount === FIRST_ORDER_COUNT;
  return isFirst === (eligibility.audience === 'first') ? null : 'audience';
};

/** The rules in the order their reason is reported: the first refusal wins (D2417). */
const RULES: readonly EligibilityRule[] = [
  (offer, _cart, snapshot) => isInSchedule(offer, snapshot.now),
  channelRule,
  wilayaRule,
  deliveryMethodRule,
  audienceRule,
  checkUsageLimits,
];

/**
 * Whether the offer may apply to this cart, kind aside: schedule → channel → wilaya → delivery method → audience →
 * total usage → per-buyer usage. Empty lists mean "all" (D2420).
 *
 * @returns `null` when eligible, else the first reason it is not.
 */
export function checkEligibility(offer: Offer, cart: PricingCart, snapshot: PricingSnapshot): SkipReason | null {
  for (const rule of RULES) {
    const reason = rule(offer, cart, snapshot);
    if (reason !== null) return reason;
  }
  return null;
}
