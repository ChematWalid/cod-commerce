import { IMPORT_MAX_IMAGE_URLS, IMPORT_MAX_URL_CHARS, MONEY_MAX_DZD, PLATFORM_CURRENCY_CODE } from '@cod/shared';
import { type LdNode, productNodeOf } from './json-ld';
import { type PageParts, readPageParts } from './page-parts';

/**
 * What a product page tells about its product (D2214): plain text, a description already HTML-escaped (so catalog's
 * sanitiser stores it inert), absolute `http(s)` image links and a whole-DZD price. Absent when the page says nothing.
 */
export interface HtmlProduct {
  readonly title?: string;
  readonly description?: string;
  readonly price?: number;
  readonly imageUrls: readonly string[];
}

const IMAGE_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);
/** C0 and C1 controls and the bidi embeddings, overrides, isolates and marks. */
// eslint-disable-next-line no-control-regex -- these are the characters being removed
const UNSAFE_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
/** Spaces a price may group its thousands with: ASCII, no-break and narrow no-break. */
const PRICE_SPACES = /[\s\u00a0\u202f]/g;
const DIGITS_IN_GROUP = 3;
/** A structured amount as schema.org and Open Graph write it: digits, a dot as the decimal separator, no grouping. */
const STRUCTURED_AMOUNT = /^\d+(?:\.\d+)?$/;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** One line of plain text: no control or bidi character, runs of white space as one space; undefined when empty. */
function plainText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.replace(UNSAFE_CHARACTERS, '').replace(/\s+/g, ' ').trim();
  return text === '' ? undefined : text;
}

const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? '');

const TITLE_KEY = 'og:title';
const DESCRIPTION_KEYS = ['og:description', 'description'] as const;
const IMAGE_KEY = 'og:image';
const PRICE_AMOUNT_KEYS = ['product:price:amount', 'og:price:amount'] as const;
const PRICE_CURRENCY_KEYS = ['product:price:currency', 'og:price:currency'] as const;
/** Every `<meta>` key a product is read from; the page scan keeps no other. */
const META_KEYS: ReadonlySet<string> = new Set([
  TITLE_KEY,
  ...DESCRIPTION_KEYS,
  IMAGE_KEY,
  ...PRICE_AMOUNT_KEYS,
  ...PRICE_CURRENCY_KEYS,
]);

/** The `content` of every `<meta>` whose `property` or `name` is `key`, in page order. */
const metaContents = (page: PageParts, key: string): string[] =>
  page.metas.filter((meta) => meta.key === key).map((meta) => meta.content);

/** The first non-empty content among the metas named `keys`, tried in order. */
const firstMeta = (page: PageParts, ...keys: string[]): string | undefined =>
  keys.map((key) => plainText(metaContents(page, key)[0])).find((value) => value !== undefined);

/** An absolute `http(s)` link of at most 2 048 characters, resolved against the page; any other scheme is dropped. */
function imageUrlOf(value: unknown, pageUrl: string): string | undefined {
  if (typeof value !== 'string' || !URL.canParse(value.trim(), pageUrl)) return undefined;
  const url = new URL(value.trim(), pageUrl);
  return IMAGE_PROTOCOLS.has(url.protocol) && url.href.length <= IMPORT_MAX_URL_CHARS ? url.href : undefined;
}

/** The images JSON-LD gives: one link, a list of links, or `ImageObject`s with a `url`. */
function ldImages(image: unknown): unknown[] {
  const items: unknown[] = Array.isArray(image) ? (image as unknown[]) : [image];
  return items.map((item) => (isRecord(item) ? item['url'] : item));
}

function imageUrlsOf(page: PageParts, product: LdNode | undefined, pageUrl: string) {
  const candidates = [...metaContents(page, IMAGE_KEY), ...ldImages(product?.['image'])];
  const urls = candidates.map((value) => imageUrlOf(value, pageUrl)).filter((url) => url !== undefined);
  return [...new Set(urls)].slice(0, IMPORT_MAX_IMAGE_URLS);
}

/** A price as a page states it: the amount and, when the page says, its currency code. */
interface StatedPrice {
  readonly amount: unknown;
  readonly currency?: unknown;
}

/** The price of the first JSON-LD offer (`price`, else `lowPrice`) and its `priceCurrency`. */
function ldPrice(product: LdNode | undefined): StatedPrice | undefined {
  const offers = product?.['offers'];
  const offer: unknown = Array.isArray(offers) ? (offers as unknown[])[0] : offers;
  if (!isRecord(offer)) return undefined;
  const amount = offer['price'] ?? offer['lowPrice'];
  return amount === undefined ? undefined : { amount, currency: offer['priceCurrency'] };
}

/** The `product:price:*` (or `og:price:*`) meta price and its currency. */
function metaPrice(page: PageParts): StatedPrice | undefined {
  const amount = firstMeta(page, ...PRICE_AMOUNT_KEYS);
  if (amount === undefined) return undefined;
  return { amount, currency: firstMeta(page, ...PRICE_CURRENCY_KEYS) };
}

/**
 * The page's price in whole DZD (D2272): a price stated in another currency is unknown, never stored as dinars.
 * A price with no currency is read as DZD.
 */
function priceOf(stated: StatedPrice | undefined): number | undefined {
  if (stated === undefined) return undefined;
  const { currency } = stated;
  const inDinars =
    currency === undefined ||
    (typeof currency === 'string' && currency.trim().toUpperCase() === PLATFORM_CURRENCY_CODE);
  return inDinars ? parsePrice(structuredAmountOf(stated.amount) ?? stated.amount) : undefined;
}

/**
 * A JSON-LD or meta amount read as structured data (D2274): `1500.000` is 1 500, never 1 500 000. Undefined when the
 * page wrote it as free text (`1 500,00 DA`), which the locale reading of {@link parsePrice} then takes.
 */
function structuredAmountOf(amount: unknown): number | undefined {
  if (typeof amount !== 'string') return undefined;
  const digits = amount.replace(PRICE_SPACES, '');
  return STRUCTURED_AMOUNT.test(digits) ? Number(digits) : undefined;
}

/** The decimal separator of a price's digits: the later of `.` and `,`, unless it only groups thousands. */
function decimalSeparatorOf(digits: string): string | undefined {
  const last = Math.max(digits.lastIndexOf('.'), digits.lastIndexOf(','));
  if (last < 0) return undefined;
  const separator = digits.charAt(last);
  const onlyOnce = digits.indexOf(separator) === last;
  const groupsThousands =
    digits.length - last - 1 === DIGITS_IN_GROUP && !digits.includes(separator === '.' ? ',' : '.');
  return onlyOnce && !groupsThousands ? separator : undefined;
}

/**
 * A page's price in whole DZD, rounded half-up (ADR 0004): `1 500,00 DA` → 1500, `DZD 2,350.50` → 2351,
 * `1.234.567` → 1234567. Undefined for no number, a negative one or one above the money maximum.
 */
export function parsePrice(value: unknown): number | undefined {
  const amount = typeof value === 'number' ? value : amountOfText(value);
  if (amount === undefined || !Number.isFinite(amount) || amount < 0) return undefined;
  const rounded = Math.round(amount);
  return rounded > MONEY_MAX_DZD ? undefined : rounded;
}

/**
 * One number as free text writes it: digit groups joined by single grouping or decimal separators. A currency word
 * around it (`د.ج`, `DA.`) is never part of it, so its dots never read as a separator.
 */
const NUMBER_RUN = /\d+(?:[.,\s\u00a0\u202f]\d+)*/g;
/** A space inside a number that does not start a group of exactly three digits (`1500 3`): not one number. */
const LOOSE_SPACE_GROUP = /[\s\u00a0\u202f](?!\d{3}(?:\D|$))/;

/** The text's one number, or undefined when it holds none, several, or one with a loose space group. */
function onlyNumberOf(text: string): string | undefined {
  const runs = text.match(NUMBER_RUN);
  const run = runs?.length === 1 ? runs[0] : undefined;
  return run === undefined || LOOSE_SPACE_GROUP.test(run) ? undefined : run;
}

/**
 * The amount of a free-text price (D2275): unknown unless the text holds exactly one number, so `1500 DA au lieu de
 * 2000 DA` or `2 500 DA / 3 pièces` is never two numbers glued together, and a range or minus sign is unknown.
 */
function amountOfText(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.includes('-')) return undefined;
  const run = onlyNumberOf(value);
  if (run === undefined) return undefined;
  const digits = run.replace(PRICE_SPACES, '');
  const separator = decimalSeparatorOf(digits);
  const [whole = '', fraction = ''] = separator === undefined ? [digits] : digits.split(separator);
  const amount = Number(`${whole.replace(/[.,]/g, '')}.${fraction.replace(/[.,]/g, '') || '0'}`);
  return Number.isNaN(amount) ? undefined : amount;
}

/**
 * Reads a product page (D2214): the title from `og:title`, JSON-LD `name` or `<title>`; the description from
 * `og:description`, `description` or JSON-LD, escaped; images from `og:image` and JSON-LD; the price from the JSON-LD
 * offer or the `product:price:amount` meta, unknown when stated in another currency. The page is read by one linear
 * scan (D2275); nothing of it is ever run or kept as markup.
 */
export function readHtmlProduct(html: string, pageUrl: string): HtmlProduct {
  const page = readPageParts(html, META_KEYS);
  const product = productNodeOf(page.ldBlocks);
  const price = priceOf(ldPrice(product) ?? metaPrice(page));
  return {
    ...textOf(page, product),
    ...(price === undefined ? {} : { price }),
    imageUrls: imageUrlsOf(page, product, pageUrl),
  };
}

/** The page's title and escaped description, each from the first source that has one. */
function textOf(page: PageParts, product: LdNode | undefined): Pick<HtmlProduct, 'title' | 'description'> {
  const title = firstMeta(page, TITLE_KEY) ?? plainText(product?.['name']) ?? plainText(page.title);
  const description = firstMeta(page, ...DESCRIPTION_KEYS) ?? plainText(product?.['description']);
  return {
    ...(title === undefined ? {} : { title }),
    ...(description === undefined ? {} : { description: escapeHtml(description) }),
  };
}
