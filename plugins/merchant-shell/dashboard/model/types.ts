import type { SoldOutBehavior } from '@cod/shared';

/** The icons of the navigation groups, by meaning; `nav/icons.ts` maps each name to a drawn icon. */
export const SHELL_ICON_NAMES = [
  'home',
  'orders',
  'tracking',
  'products',
  'analytics',
  'inventory',
  'finance',
  'team',
  'delivery',
  'apps',
  'sourcing',
  'settings',
] as const;

/** One of the {@link SHELL_ICON_NAMES}. */
export type ShellIconName = (typeof SHELL_ICON_NAMES)[number];

/** A store the caller can switch to, as the `switchableStores` query returns it. It carries no channel token. */
export interface SwitchableStoreView {
  readonly id: string;
  readonly businessId: string;
  readonly channelId: string;
  readonly name: string;
  readonly subdomain: string;
  readonly language: string;
}

/** What the shell hands a page: the store it is scoped to, set only on store-scoped leaves. */
export interface ShellPageProps {
  readonly store: SwitchableStoreView | undefined;
}

/** The business as `activeBusiness` returns the part the settings page edits. */
export interface BusinessRecord {
  readonly id: string;
  readonly name: string;
  readonly logoAssetId: string | null;
  /** Set only for an asset of the business's own channels (D2120). */
  readonly logoUrl: string | null;
}

/** A store as `store(id)` returns the part the settings page edits. */
export interface StoreRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly language: string;
  readonly logoAssetId: string | null;
  readonly logoUrl: string | null;
  readonly showAddressField: boolean;
  readonly soldOutBehavior: SoldOutBehavior;
}
