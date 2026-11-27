import type { PermissionKey } from '@cod/shared';
import { VIEW_CARRIERS_KEY, VIEW_PRICING_KEY } from '../constants';

/** The tabs of the Delivery & shipping page, in display order (captured: Carriers / Delivery Pricing). */
export const DELIVERY_TABS = ['carriers', 'pricing'] as const;

/** One of the {@link DELIVERY_TABS}. */
export type DeliveryTab = (typeof DELIVERY_TABS)[number];

/** The key a tab needs: the leaf opens with either, and each tab shows only to its own key's holder. */
const TAB_KEYS: Readonly<Record<DeliveryTab, PermissionKey>> = {
  carriers: VIEW_CARRIERS_KEY,
  pricing: VIEW_PRICING_KEY,
};

/** The catalogue id of each tab's label. */
export const TAB_LABEL_IDS: Readonly<Record<DeliveryTab, string>> = {
  carriers: 'delivery-pricing.tab-carriers',
  pricing: 'delivery-pricing.tab-pricing',
};

const isDeliveryTab = (value: unknown): value is DeliveryTab =>
  typeof value === 'string' && (DELIVERY_TABS as readonly string[]).includes(value);

/** The tabs the caller sees: those whose key the server says they hold on the active store. */
export function deliveryTabsOf(held: ReadonlySet<string>): DeliveryTab[] {
  return DELIVERY_TABS.filter((tab) => held.has(TAB_KEYS[tab]));
}

/** The tab to show: the URL's `tab` when it is one the caller sees, else the first they see, else none. */
export function shownTabOf(requested: unknown, tabs: readonly DeliveryTab[]): DeliveryTab | null {
  if (isDeliveryTab(requested) && tabs.includes(requested)) return requested;
  return tabs[0] ?? null;
}

/** The URL search of a tab: `?tab=pricing` for the pricing tab (as captured), none for the carriers tab. */
export function tabSearchOf(tab: DeliveryTab): { readonly tab?: DeliveryTab } {
  return tab === 'pricing' ? { tab } : {};
}
