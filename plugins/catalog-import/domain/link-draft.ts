import { DESCRIPTION_MAX, PRODUCT_TITLE_MAX } from '@cod/shared';
import type { HtmlProduct } from './html-product';
import type { ImportCreate } from './import-writes';

/** What a link import never guesses: a product with no price on its page starts at 0, to be priced in its Draft. */
const UNKNOWN_PRICE = 0;
const HIGH_SURROGATE_FIRST = 0xd800;
const HIGH_SURROGATE_LAST = 0xdbff;

/** A link import's product: always a Draft, to be reviewed (images included) before it sells (D2214). */
export interface LinkDraft {
  readonly create: ImportCreate;
  readonly imageUrls: readonly string[];
}

/**
 * `text` within `max` UTF-16 units (catalog counts lengths so), never ending on half of a character: a lone surrogate
 * would make catalog refuse a reachable page as invalid input (D2274).
 */
function cutWithin(text: string, max: number): string {
  const cut = text.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  return Number.isNaN(last) || !isHighSurrogate(last) ? cut : cut.slice(0, -1);
}

const isHighSurrogate = (code: number): boolean => code >= HIGH_SURROGATE_FIRST && code <= HIGH_SURROGATE_LAST;

/** The page's title within catalog's length, else the link's host: a product needs a title (D2272). */
const titleOf = (page: HtmlProduct, sourceUrl: string): string =>
  cutWithin(page.title ?? new URL(sourceUrl).hostname, PRODUCT_TITLE_MAX).trim();

/** The page's escaped description within catalog's length, cut before an entity it would split. */
function descriptionOf(page: HtmlProduct): string | undefined {
  if (page.description === undefined) return undefined;
  const cut = cutWithin(page.description, DESCRIPTION_MAX);
  const entityStart = cut.lastIndexOf('&');
  return entityStart > cut.lastIndexOf(';') ? cut.slice(0, entityStart) : cut;
}

/** The Draft product a scraped page makes (D2214): no variants, options, brand or tags; the images stored only. */
export function linkDraftOf(page: HtmlProduct, sourceUrl: string): LinkDraft {
  const description = descriptionOf(page);
  return {
    create: {
      product: {
        title: titleOf(page, sourceUrl),
        ...(description === undefined || description === '' ? {} : { description }),
        status: 'draft',
        price: page.price ?? UNKNOWN_PRICE,
        tagIds: [],
        optionGroups: [],
      },
      variants: [],
    },
    imageUrls: page.imageUrls,
  };
}
