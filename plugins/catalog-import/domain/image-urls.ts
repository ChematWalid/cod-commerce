import { IMPORT_MAX_IMAGE_URLS, IMPORT_MAX_URL_CHARS } from '@cod/shared';
import { splitListCell } from './list-cell';

const LINK_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

/** The verdict of {@link parseImageUrls}: the links, or a refusal that names none of them. */
export type ImageUrlsVerdict = { readonly ok: true; readonly urls: readonly string[] } | { readonly ok: false };

const isImageUrl = (value: string): boolean =>
  value.length <= IMPORT_MAX_URL_CHARS && URL.canParse(value) && LINK_PROTOCOLS.has(new URL(value).protocol);

/**
 * The `image_urls` cell (D2209): `;`-separated absolute `http:`/`https:` links, at most {@link IMPORT_MAX_IMAGE_URLS}
 * of at most {@link IMPORT_MAX_URL_CHARS} characters each. They are stored on the product's origin row only, never
 * fetched or rendered in P2.S2 (assets come with P9.S7b).
 */
export function parseImageUrls(cell: string): ImageUrlsVerdict {
  const urls = splitListCell(cell);
  if (urls.length > IMPORT_MAX_IMAGE_URLS || !urls.every(isImageUrl)) return { ok: false };
  return { ok: true, urls };
}
