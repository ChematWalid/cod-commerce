import { z } from 'zod';
import { INT_COLUMN_MAX } from '../catalog/constants';
import { hasBidiControl, hasControlCharacter, hasLoneSurrogate } from '../text/control-characters';
import { WILAYA_CODES, type WilayaCode } from '../wilayas/wilayas';
import {
  AUDIENCES,
  DELIVERY_METHODS,
  OFFER_METHODS,
  OFFER_TARGET_ROLES,
  PRICING_CHANNELS,
  TARGET_REF_TYPES,
  type Audience,
  type DeliveryMethod,
  type OfferMethod,
  type OfferStatus,
  type OfferTargetRole,
  type PricingChannel,
  type TargetRefType,
} from './channels';
import { KIND_MAX_LENGTH, KIND_PATTERN, MAX_OFFER_TARGETS, OFFER_LABEL_MAX, OFFER_TITLE_MAX } from './constants';
import { isCoreIdText } from './core-id';
import { invalidOfferConfig } from './error-codes';

/** A single-line offer text: trimmed, non-empty, no control, bidi override or lone surrogate character. */
export function offerTextSchema(max: number) {
  return z
    .string(invalidOfferConfig)
    .trim()
    .min(1, invalidOfferConfig)
    .max(max, invalidOfferConfig)
    .refine(
      (value) => !hasControlCharacter(value) && !hasBidiControl(value) && !hasLoneSurrogate(value),
      invalidOfferConfig,
    );
}

/** A text per language, each optional: `{ ar?, fr?, en? }`. */
export const localizedLabelSchema = z.object(
  {
    ar: offerTextSchema(OFFER_LABEL_MAX).optional(),
    fr: offerTextSchema(OFFER_LABEL_MAX).optional(),
    en: offerTextSchema(OFFER_LABEL_MAX).optional(),
  },
  invalidOfferConfig,
);

/** A list of distinct values of `values`, empty meaning "all" (D2420). */
function distinctListOf<const Values extends readonly [string, ...string[]]>(values: Values) {
  return z
    .array(z.enum(values, invalidOfferConfig), invalidOfferConfig)
    .max(values.length, invalidOfferConfig)
    .refine((list) => new Set(list).size === list.length, invalidOfferConfig)
    .default([]);
}

/** Which other classes of offer this one combines with (D2411); nothing by default. */
export const combinesWithSchema = z.object(
  {
    order: z.boolean(invalidOfferConfig).default(false),
    product: z.boolean(invalidOfferConfig).default(false),
    delivery: z.boolean(invalidOfferConfig).default(false),
  },
  invalidOfferConfig,
);

/** Who and where an offer applies; an empty list means every channel, wilaya or delivery method. */
export const eligibilitySchema = z.object(
  {
    audience: z.enum(AUDIENCES, invalidOfferConfig).default('everyone'),
    channels: distinctListOf(PRICING_CHANNELS),
    wilayas: distinctListOf(WILAYA_CODES),
    deliveryMethods: distinctListOf(DELIVERY_METHODS),
  },
  invalidOfferConfig,
);

/** A target's Vendure core id: stored in an `integer` column (D2405), so bounded to it here. */
const targetRefIdSchema = z.string(invalidOfferConfig).refine(isCoreIdText, invalidOfferConfig);

/** A variant, product or collection an offer targets. */
export const offerTargetInputSchema = z.object(
  {
    role: z.enum(OFFER_TARGET_ROLES, invalidOfferConfig).default('buy'),
    refType: z.enum(TARGET_REF_TYPES, invalidOfferConfig),
    refId: targetRefIdSchema,
  },
  invalidOfferConfig,
);

const usageLimitSchema = z
  .number(invalidOfferConfig)
  .int(invalidOfferConfig)
  .min(1, invalidOfferConfig)
  .max(INT_COLUMN_MAX, invalidOfferConfig)
  .nullable()
  .default(null);

const instantSchema = z.iso
  .datetime({ offset: true, ...invalidOfferConfig })
  .nullable()
  .default(null);

const endsAfterStart = ({ startsAt, endsAt }: { startsAt: string | null; endsAt: string | null }): boolean =>
  startsAt === null || endsAt === null || Date.parse(endsAt) > Date.parse(startsAt);

/**
 * "Create or edit an offer" for the admin use case (D2431). `config` is checked afterwards with the schema of the
 * kind's registry adapter (D2404); the status changes through its own transitions, never here.
 */
export const offerInputSchema = z
  .object(
    {
      kind: z
        .string(invalidOfferConfig)
        .min(1, invalidOfferConfig)
        .max(KIND_MAX_LENGTH, invalidOfferConfig)
        .regex(KIND_PATTERN, invalidOfferConfig),
      method: z.enum(OFFER_METHODS, invalidOfferConfig).default('automatic'),
      title: offerTextSchema(OFFER_TITLE_MAX),
      label: localizedLabelSchema.prefault({}),
      config: z.unknown(),
      combinesWith: combinesWithSchema.prefault({}),
      eligibility: eligibilitySchema.prefault({}),
      totalUsageLimit: usageLimitSchema,
      perBuyerLimit: usageLimitSchema,
      startsAt: instantSchema,
      endsAt: instantSchema,
      targets: z
        .array(offerTargetInputSchema, invalidOfferConfig)
        .max(MAX_OFFER_TARGETS, invalidOfferConfig)
        .default([]),
    },
    invalidOfferConfig,
  )
  .refine(endsAfterStart, invalidOfferConfig);

export type OfferInput = z.input<typeof offerInputSchema>;
export type OfferCommand = z.output<typeof offerInputSchema>;
export type OfferLabel = z.output<typeof localizedLabelSchema>;
export type CombinesWith = z.output<typeof combinesWithSchema>;

/** Who and where an offer applies, as the engine reads it. */
export interface OfferEligibility {
  audience: Audience;
  channels: PricingChannel[];
  wilayas: WilayaCode[];
  deliveryMethods: DeliveryMethod[];
}

/** A target as the engine reads it. */
export interface OfferTarget {
  role: OfferTargetRole;
  refType: TargetRefType;
  refId: string;
}

/** An offer as the pricing engine sees it: ids are decimal strings, instants are UTC (D2419). */
export interface OfferDefinition {
  id: string;
  kind: string;
  method: OfferMethod;
  title: string;
  label: OfferLabel;
  /** Kind-specific; parsed by the kind's adapter before use (D2404). */
  config: unknown;
  combinesWith: CombinesWith;
  eligibility: OfferEligibility;
  totalUsageLimit: number | null;
  perBuyerLimit: number | null;
  status: OfferStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  publishedAt: Date | null;
  usageCount: number;
  targets: OfferTarget[];
}
