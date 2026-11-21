import { z } from 'zod';
import { INT_COLUMN_MAX } from '../catalog/constants';
import { MONEY_MAX_DZD } from '../catalog/money';
import { OFFER_STATUSES, type OfferAppGoal, type OfferMethod } from './channels';
import {
  GENERATED_CODE_PREFIX_MAX,
  GENERATED_CODE_PREFIX_PATTERN,
  KIND_MAX_LENGTH,
  KIND_PATTERN,
  MAX_CODES_PER_ADD,
  OFFER_PAGE_MAX,
  OFFER_PAGE_SIZE,
  PREVIEW_DELIVERY_FEE,
  PREVIEW_SAMPLE_PRICE,
} from './constants';
import { isCoreIdText } from './core-id';
import { invalidOfferConfig, invalidQuoteRequest } from './error-codes';
import { offerInputSchema } from './offer-model';
import type { Quote } from './quote';

/** What a publish refuses an incomplete offer for; the codes only, never the input (D2510). */
export const PUBLISH_PROBLEMS = ['title', 'targets', 'dates'] as const;
/** A configuration the engine prices, but likely not as the merchant meant (D2516). */
export const OFFER_CONFIG_WARNINGS = ['tier_total_not_divisible'] as const;

export type PublishProblem = (typeof PUBLISH_PROBLEMS)[number];
export type OfferConfigWarning = (typeof OFFER_CONFIG_WARNINGS)[number];

/** The options object without its null or empty fields: an unset GraphQL variable or an empty query field. */
function withoutUnsetFields(options: unknown): unknown {
  const source = options ?? {};
  if (typeof source !== 'object' || Array.isArray(source)) return source;
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== null && value !== ''));
}

const listFieldsSchema = z.object(
  {
    status: z.enum(OFFER_STATUSES, invalidQuoteRequest).optional(),
    kind: z
      .string(invalidQuoteRequest)
      .max(KIND_MAX_LENGTH, invalidQuoteRequest)
      .regex(KIND_PATTERN, invalidQuoteRequest)
      .optional(),
    productId: z.string(invalidQuoteRequest).refine(isCoreIdText, invalidQuoteRequest).optional(),
    skip: z.coerce
      .number(invalidQuoteRequest)
      .int(invalidQuoteRequest)
      .min(0, invalidQuoteRequest)
      .max(INT_COLUMN_MAX, invalidQuoteRequest)
      .default(0),
    take: z.coerce
      .number(invalidQuoteRequest)
      .int(invalidQuoteRequest)
      .min(1, invalidQuoteRequest)
      .max(OFFER_PAGE_MAX, invalidQuoteRequest)
      .default(OFFER_PAGE_SIZE),
  },
  invalidQuoteRequest,
);

/**
 * A page of the admin offer list, newest first (D2513). It may come as a REST query string; filters combine with AND,
 * and `productId` keeps the offers that target the product or one of its variants.
 */
export const offerListOptionsSchema = z.preprocess(withoutUnsetFields, listFieldsSchema);

export type OfferListOptionsInput = z.input<typeof listFieldsSchema>;
export type OfferListOptions = z.output<typeof offerListOptionsSchema>;

/** "Generate codes" (D2512): `count` random codes behind an optional upper-case prefix, each with its own limit. */
export const generateCodesInputSchema = z.object(
  {
    count: z
      .number(invalidOfferConfig)
      .int(invalidOfferConfig)
      .min(1, invalidOfferConfig)
      .max(MAX_CODES_PER_ADD, invalidOfferConfig),
    prefix: z
      .string(invalidOfferConfig)
      .max(GENERATED_CODE_PREFIX_MAX, invalidOfferConfig)
      .regex(GENERATED_CODE_PREFIX_PATTERN, invalidOfferConfig)
      .default(''),
    usageLimit: z
      .number(invalidOfferConfig)
      .int(invalidOfferConfig)
      .min(1, invalidOfferConfig)
      .max(INT_COLUMN_MAX, invalidOfferConfig)
      .nullable()
      .default(null),
  },
  invalidOfferConfig,
);

export type GenerateCodesInput = z.input<typeof generateCodesInputSchema>;
export type GenerateCodesCommand = z.output<typeof generateCodesInputSchema>;

/** "Preview this draft" (D2516): the unsaved offer, priced on synthetic carts at a sample price and delivery fee. */
export const offerPreviewInputSchema = z.object(
  {
    offer: offerInputSchema,
    samplePrice: z
      .number(invalidQuoteRequest)
      .int(invalidQuoteRequest)
      .min(1, invalidQuoteRequest)
      .max(MONEY_MAX_DZD, invalidQuoteRequest)
      .default(PREVIEW_SAMPLE_PRICE),
    sampleDeliveryFee: z
      .number(invalidQuoteRequest)
      .int(invalidQuoteRequest)
      .min(0, invalidQuoteRequest)
      .max(MONEY_MAX_DZD, invalidQuoteRequest)
      .default(PREVIEW_DELIVERY_FEE),
  },
  invalidQuoteRequest,
);

export type OfferPreviewInput = z.input<typeof offerPreviewInputSchema>;
export type OfferPreviewCommand = z.output<typeof offerPreviewInputSchema>;

/** What an offer brought, from the orders that applied it (D2514); all zero before any order. */
export interface OfferPerformance {
  /** Orders holding the offer, voided ones excluded. */
  orders: number;
  /** Total of the delivered orders holding the offer, in DZD. */
  deliveredRevenue: number;
  /** The offer's discount over the orders holding it, voided ones excluded, in DZD. */
  discountGiven: number;
}

/** A card of the create dialog (D2515): a kind with a method, grouped by goal; labels are frontend i18n by `id`. */
export interface OfferAppType {
  id: string;
  kind: string;
  method: OfferMethod;
  goal: OfferAppGoal | null;
  recommended: boolean;
}

/** The parts of a quote a preview shows (D2516). */
export type PreviewQuote = Pick<
  Quote,
  'lines' | 'subtotal' | 'discountTotal' | 'delivery' | 'total' | 'savings' | 'nudge' | 'suggestions'
>;

/** One synthetic cart of a preview: its pieces, whether its add-on was accepted, and its quote. */
export interface PreviewScenario {
  pieces: number;
  addonAccepted: boolean;
  quote: PreviewQuote;
}

/** A draft offer priced by the engine on synthetic carts, with the configuration warnings (D2516). */
export interface OfferPreview {
  scenarios: PreviewScenario[];
  warnings: OfferConfigWarning[];
}
