import { BUILT_IN_NAV_SECTION_IDS, type NavMenuConfig } from '@vendure/dashboard';
import { BUILT_IN_SECTION_IDS, buildMerchantNav } from './nav-config';
import type { ShellIconName } from './types';

/**
 * Compile-time checks, run by `typecheck` (the dashboard tsconfig) and never imported: unit tests cannot load
 * `@vendure/dashboard`, so `nav-config.ts` copies its section ids and mirrors its types.
 */
type StockSectionId = (typeof BUILT_IN_NAV_SECTION_IDS)[keyof typeof BUILT_IN_NAV_SECTION_IDS];
type CopiedSectionId = (typeof BUILT_IN_SECTION_IDS)[number];

/** Fails to compile when the two id lists differ, in either direction. */
export const SECTION_IDS_MATCH: [StockSectionId] extends [CopiedSectionId]
  ? [CopiedSectionId] extends [StockSectionId]
    ? true
    : never
  : never = true;

/** Fails to compile when `buildMerchantNav` no longer takes and returns the stock `NavMenuConfig`. */
export function buildStockMerchantNav(config: NavMenuConfig, icons: Record<ShellIconName, never>): NavMenuConfig {
  return buildMerchantNav(config, icons);
}
