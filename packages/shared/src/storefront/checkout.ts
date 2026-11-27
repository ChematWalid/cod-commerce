import { z } from 'zod';
import { MONEY_MAX_DZD } from '../catalog/money';
import { ORDER_PRICING_MODES } from '../pricing/channels';
import { MAX_LINE_QUANTITY, MAX_QUOTE_LINES, MAX_QUOTE_TOKEN_LENGTH, TOWN_ONS_MAX_LENGTH } from '../pricing/constants';
import { invalidQuoteRequest } from '../pricing/error-codes';
import { pricingIdSchema, quoteRequestSchema } from '../pricing/quote-request';
import { ADDON_REJECT_REASONS, type CodeRejectReason, type SkipReason } from '../pricing/reasons';
import { CURRENCY_CODE_PATTERN, PROVINCE_CODE_MAX_LENGTH, TOWN_ONS_PATTERN } from './checkout-constants';

/**
 * `POST /store/shipping-quote` body (D3301): data-model item 2 without `storeId`, which comes from the signed store.
 * Unknown keys (`waive`, `storeId`) are stripped: a buyer never waives their own fee. Which wilaya and commune codes
 * exist is the geo data's answer, not this schema's.
 */
export const storefrontShippingQuoteBodySchema = z.object(
  {
    provinceCode: z
      .string(invalidQuoteRequest)
      .min(1, invalidQuoteRequest)
      .max(PROVINCE_CODE_MAX_LENGTH, invalidQuoteRequest),
    townOns: z
      .string(invalidQuoteRequest)
      .max(TOWN_ONS_MAX_LENGTH, invalidQuoteRequest)
      .regex(TOWN_ONS_PATTERN, invalidQuoteRequest)
      .optional(),
    stopdesk: z.boolean(invalidQuoteRequest),
    items: z
      .array(
        z.object(
          {
            productId: pricingIdSchema,
            quantity: z
              .number(invalidQuoteRequest)
              .int(invalidQuoteRequest)
              .min(1, invalidQuoteRequest)
              .max(MAX_LINE_QUANTITY, invalidQuoteRequest),
          },
          invalidQuoteRequest,
        ),
        invalidQuoteRequest,
      )
      .min(1, invalidQuoteRequest)
      .max(MAX_QUOTE_LINES, invalidQuoteRequest),
  },
  invalidQuoteRequest,
);

/** A parsed shipping-quote body. */
export type StorefrontShippingQuoteBody = z.output<typeof storefrontShippingQuoteBodySchema>;

/**
 * `POST /store/cart-quote` body (D3303): the quote request without `channel` and `addons`, which the server forces to
 * `storefront` and none. A client `channel` or `addons` is stripped, never read.
 */
export const storefrontCartQuoteBodySchema = quoteRequestSchema.omit({ channel: true, addons: true });

/** A cart-quote body as a client writes it. */
export type StorefrontCartQuoteBodyInput = z.input<typeof storefrontCartQuoteBodySchema>;
/** A parsed cart-quote body: phone in E.164 or null. */
export type StorefrontCartQuoteBody = z.output<typeof storefrontCartQuoteBodySchema>;

/** Skip reasons a public quote never shows: they would reveal a phone's order history or staff-only offers (D3313). */
export const PRIVATE_SKIP_REASONS = ['channel', 'audience', 'per_buyer_limit'] as const satisfies readonly SkipReason[];
/** Code reasons a public quote reads as `not_eligible` (D3313). */
export const PRIVATE_CODE_REJECT_REASONS = ['per_buyer_limit'] as const satisfies readonly CodeRejectReason[];

/** Why a matched offer was skipped, as a public quote may say it: every skip reason but the private ones. */
export const PUBLIC_SKIP_REASONS = [
  'no_tier_reached',
  'not_started',
  'ended',
  'wilaya',
  'delivery_method',
  'usage_limit',
  'min_not_met',
  'not_combinable',
] as const satisfies readonly Exclude<SkipReason, (typeof PRIVATE_SKIP_REASONS)[number]>[];

/** Why a code gave no discount, as a public quote may say it; per-buyer reasons read `not_eligible`. */
export const PUBLIC_CODE_REJECT_REASONS = [
  'not_found',
  'not_started',
  'ended',
  'inactive',
  'code_limit',
  'usage_limit',
  'not_eligible',
  'min_not_met',
  'no_matching_items',
  'not_combinable',
  'duplicate',
] as const satisfies readonly Exclude<CodeRejectReason, (typeof PRIVATE_CODE_REJECT_REASONS)[number]>[];

/** One of the {@link PUBLIC_CODE_REJECT_REASONS}. */
export type PublicCodeRejectReason = (typeof PUBLIC_CODE_REJECT_REASONS)[number];

const moneySchema = z.number().int().min(0).max(MONEY_MAX_DZD);
const countSchema = z.number().int().min(0);
const offerAmountSchema = z.object({ offerId: z.string(), kind: z.string(), amount: moneySchema });

const publicQuoteLineSchema = z.object({
  key: z.string(),
  productId: z.string(),
  variantId: z.string(),
  quantity: countSchema,
  originalPrice: moneySchema,
  unitPrice: moneySchema,
  totalPrice: moneySchema,
  discounts: z.array(offerAmountSchema),
  giftOf: z.string().optional(),
  addonOf: z.string().optional(),
  parentVariantId: z.string().nullable().optional(),
});

const deliveryBlockSchema = z.object({
  resolved: z.boolean(),
  fee: moneySchema,
  overweightFee: moneySchema,
  waived: z.boolean(),
  price: moneySchema,
  freeShipping: z.boolean(),
  speed: z.string().nullable(),
});

const nudgeSchema = z.object({
  type: z.literal('next_tier'),
  offerId: z.string(),
  units: countSchema,
  tierQuantity: countSchema,
  saving: moneySchema,
});

const suggestionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('free_delivery'),
    offerId: z.string(),
    missing: z.object({ pieces: countSchema.optional(), amount: moneySchema.optional() }),
  }),
  z.object({ type: z.literal('gift'), offerId: z.string(), units: countSchema }),
]);

/**
 * The quote `POST /store/cart-quote` answers (D3313): the engine `Quote` with no private reason. Skipped entries for
 * `channel`, `audience` and `per_buyer_limit` are absent and per-buyer code reasons read `not_eligible`, so a public,
 * phone-accepting endpoint reveals neither a phone's order history nor staff-only offers. A quote with a private
 * reason fails this schema, so a leak is refused on both sides. Money is whole units of `currency`.
 */
export const publicQuoteSchema = z.object({
  currency: z.string().regex(CURRENCY_CODE_PATTERN),
  lines: z.array(publicQuoteLineSchema),
  discounts: z.array(offerAmountSchema.extend({ code: z.string().optional() })),
  subtotal: moneySchema,
  discountTotal: moneySchema,
  delivery: deliveryBlockSchema,
  total: moneySchema,
  savings: moneySchema,
  nudge: nudgeSchema.nullable(),
  applied: z.array(offerAmountSchema.extend({ code: z.string().optional() })),
  skipped: z.array(z.object({ offerId: z.string(), reason: z.enum(PUBLIC_SKIP_REASONS) })),
  rejectedCodes: z.array(z.object({ code: z.string(), reason: z.enum(PUBLIC_CODE_REJECT_REASONS) })),
  rejectedAddons: z.array(
    z.object({ offerId: z.string(), variantId: z.string(), reason: z.enum(ADDON_REJECT_REASONS) }),
  ),
  suggestions: z.array(suggestionSchema),
  quoteToken: z.string().max(MAX_QUOTE_TOKEN_LENGTH).nullable(),
  expiresAt: z.iso.datetime().nullable(),
  available: z.boolean(),
  orderPricingMode: z.enum(ORDER_PRICING_MODES),
  unavailableVariantIds: z.array(z.string()),
});

/** A public cart quote; see {@link publicQuoteSchema}. */
export type PublicQuote = z.output<typeof publicQuoteSchema>;

/** Every refusal of a public quote or order route: a stable code only, never a message or a stack (D3303). */
export const storefrontQuoteErrorSchema = z.object({ code: z.string() });

/** A refusal of a public quote or order route. */
export type StorefrontQuoteError = z.output<typeof storefrontQuoteErrorSchema>;
