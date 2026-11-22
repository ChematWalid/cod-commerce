import { TOWN_ONS_PATTERN } from './constants';

/** A destination commune as read: none, an ONS code, or text that names no commune. */
export type TownOnsReading = { readonly ok: true; readonly codeOns: number | undefined } | { readonly ok: false };

/**
 * The ONS code an offers destination names (`townOns`, D3125): absent reads as no commune, a {@link TOWN_ONS_PATTERN}
 * match as its code, any other text as malformed, which the quote answers unresolved.
 */
export function townOnsOf(raw: string | undefined): TownOnsReading {
  if (raw === undefined) return { ok: true, codeOns: undefined };
  return TOWN_ONS_PATTERN.test(raw) ? { ok: true, codeOns: Number(raw) } : { ok: false };
}
