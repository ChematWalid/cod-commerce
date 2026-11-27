import { z } from 'zod';
import { phoneE164Schema } from '../auth/schemas';
import { isSnowflake } from '../ids/snowflake';
import { WILAYA_CODES } from '../wilayas/wilayas';
import { PRICING_CHANNELS } from './channels';
import { hasBidiControl, hasControlCharacter, hasLoneSurrogate } from '../text/control-characters';
import {
  ALGERIA_COUNTRY_CODE,
  MAX_ADDON_PIECES,
  MAX_CODE_INPUT_LENGTH,
  MAX_LINE_QUANTITY,
  MAX_PHONE_INPUT_LENGTH,
  MAX_QUOTE_ADDONS,
  MAX_QUOTE_CODES,
  MAX_QUOTE_LINES,
  TOWN_ONS_MAX_LENGTH,
} from './constants';
import { isCoreIdText } from './core-id';
import { invalidQuoteRequest, PRICING_ERROR_CODES } from './error-codes';

/** A variant id of a quote line: a Vendure core id (Postgres `integer`) as a canonical decimal string. */
export const pricingIdSchema = z.string(invalidQuoteRequest).refine(isCoreIdText, invalidQuoteRequest);

/**
 * One cart line. It names a variant only: the product comes from the store-channel variant gate (D2423), so a sent
 * `productId` is stripped and can never pair a cheap variant with a targeted product.
 */
const quoteLineInputSchema = z.object(
  {
    variantId: pricingIdSchema,
    quantity: z
      .number(invalidQuoteRequest)
      .int(invalidQuoteRequest)
      .min(1, invalidQuoteRequest)
      .max(MAX_LINE_QUANTITY, invalidQuoteRequest),
  },
  invalidQuoteRequest,
);

/**
 * An add-on the buyer accepted (D2506): the offer that offers it (a snowflake row id) and the variant, priced by the
 * engine like a line. Its quantity is capped by the offer's own per-order cap too.
 */
const quoteAddonInputSchema = z.object(
  {
    offerId: z.string(invalidQuoteRequest).refine(isSnowflake, invalidQuoteRequest),
    variantId: pricingIdSchema,
    quantity: z
      .number(invalidQuoteRequest)
      .int(invalidQuoteRequest)
      .min(1, invalidQuoteRequest)
      .max(MAX_ADDON_PIECES, invalidQuoteRequest),
  },
  invalidQuoteRequest,
);

/** One entry per offer and variant, so the cart hash has one spelling of a cart's add-ons. */
const hasDistinctAddons = (addons: readonly { offerId: string; variantId: string }[]): boolean =>
  new Set(addons.map(({ offerId, variantId }) => `${offerId}:${variantId}`)).size === addons.length;

const destinationSchema = z.object(
  {
    provinceCode: z.enum(WILAYA_CODES, invalidQuoteRequest),
    /** The commune's ONS code as text: `String(codeOns)` of a geo `Town` (P3.S1). */
    townOns: z
      .string(invalidQuoteRequest)
      .trim()
      .min(1, invalidQuoteRequest)
      .max(TOWN_ONS_MAX_LENGTH, invalidQuoteRequest)
      .optional(),
    stopdesk: z.boolean(invalidQuoteRequest),
  },
  invalidQuoteRequest,
);

const PHONE_SEPARATORS = /[\s.\-()]/g;
const BARE_ALGERIAN_NUMBER = new RegExp(`^${ALGERIA_COUNTRY_CODE}\\d`);

/** `213 555…` typed without its `+` is read as Algerian, like `+213 555…` (D2418); other spellings pass as typed. */
function withCountryPlus(raw: string): string {
  const compact = raw.replace(PHONE_SEPARATORS, '');
  return BARE_ALGERIAN_NUMBER.test(compact) ? `+${compact}` : raw;
}

/**
 * A buyer phone in any usual spelling, out as one E.164 string; an unreadable one fails the request (D2418). A blank
 * phone is no phone (`null`): a form sends `''` before the buyer types it.
 */
const quotePhoneSchema = z
  .string(invalidQuoteRequest)
  .max(MAX_PHONE_INPUT_LENGTH, invalidQuoteRequest)
  .transform((raw, context) => {
    if (raw.trim() === '') return null;
    const parsed = phoneE164Schema.safeParse(withCountryPlus(raw));
    if (parsed.success) return parsed.data;
    context.addIssue({ code: 'custom', message: PRICING_ERROR_CODES.INVALID_REQUEST });
    return z.NEVER;
  });

/** A code as typed: bounded, and free of control, bidi or lone-surrogate characters, since a rejected one is echoed. */
const codeInputSchema = z
  .string(invalidQuoteRequest)
  .max(MAX_CODE_INPUT_LENGTH, invalidQuoteRequest)
  .refine(
    (code) => !hasControlCharacter(code) && !hasBidiControl(code) && !hasLoneSurrogate(code),
    invalidQuoteRequest,
  );

/**
 * A cart-quote request (data-model.md, storefront ordering protocol step 3). It carries neither business nor store:
 * both come from the resolved tenant, never from a body (ADR 0002, D2408). Codes are kept as typed; the engine
 * normalises them (D2406).
 */
export const quoteRequestSchema = z.object(
  {
    channel: z.enum(PRICING_CHANNELS, invalidQuoteRequest),
    lines: z
      .array(quoteLineInputSchema, invalidQuoteRequest)
      .min(1, invalidQuoteRequest)
      .max(MAX_QUOTE_LINES, invalidQuoteRequest),
    destination: destinationSchema.nullish(),
    phone: quotePhoneSchema.nullish(),
    codes: z.array(codeInputSchema, invalidQuoteRequest).max(MAX_QUOTE_CODES, invalidQuoteRequest).optional(),
    addons: z
      .array(quoteAddonInputSchema, invalidQuoteRequest)
      .max(MAX_QUOTE_ADDONS, invalidQuoteRequest)
      .refine(hasDistinctAddons, invalidQuoteRequest)
      .default([]),
  },
  invalidQuoteRequest,
);

export type QuoteRequestInput = z.input<typeof quoteRequestSchema>;
/** A parsed cart-quote request: phone in E.164 or null, no product or store id. */
export type QuoteRequest = z.output<typeof quoteRequestSchema>;
/** The cart `verifyQuote` compares a token against: the same shape as a quote request. */
export type QuoteCart = QuoteRequest;
export type QuoteLineInput = QuoteRequest['lines'][number];
export type QuoteDestination = NonNullable<QuoteRequest['destination']>;
export type QuoteAddonInput = QuoteRequest['addons'][number];
