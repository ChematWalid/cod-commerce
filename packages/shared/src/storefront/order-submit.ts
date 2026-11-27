import { z } from 'zod';
import { MONEY_MAX_DZD } from '../catalog/money';
import { MAX_QUOTE_TOKEN_LENGTH } from '../pricing/constants';
import { buyerPhoneSchema } from '../phone/phone';
import { publicQuoteSchema, storefrontCartQuoteBodySchema, type StorefrontCartQuoteBody } from './checkout';
import {
  BUYER_ADDRESS_MAX,
  BUYER_NAME_MAX,
  BUYER_NOTE_MAX,
  FBP_MAX_LENGTH,
  ORDER_TIMING_MAX_MS,
} from './checkout-constants';

/*
 * S3 draft of the storefront submit contract (D3309). P3.S4 owns order intake (`packages/shared/src/intake/**`) and
 * moves or extends this file; the draft is built so P3.S4 can rebuild the exact cart the quote token hashes.
 */

const cartBodyShape = storefrontCartQuoteBodySchema.shape;
/** The destination of a quote request; the draft reuses its wilaya and commune rules, so both read codes alike. */
const destinationShape = cartBodyShape.destination.unwrap().unwrap().shape;

const timingSchema = z.number().int().min(0).max(ORDER_TIMING_MAX_MS);
const moneySchema = z.number().int().min(0).max(MONEY_MAX_DZD);
const optionalText = (max: number): z.ZodOptional<z.ZodString> => z.string().trim().max(max).optional();

/** The buyer block of a draft: who receives the parcel, and where. */
const orderClientSchema = z.object({
  name: z.string().trim().min(1).max(BUYER_NAME_MAX),
  phone: buyerPhoneSchema,
  provinceCode: destinationShape.provinceCode,
  townOns: destinationShape.townOns.unwrap(),
  address: optionalText(BUYER_ADDRESS_MAX),
  note: optionalText(BUYER_NOTE_MAX),
});

/**
 * A storefront order draft (data-model.md, storefront ordering protocol item 5, without `storeId`/`businessId`: the
 * store is the one the host resolves). `codes` are the codes as sent to the quote that issued `quoteToken`, and
 * `orderItems` its lines. Unknown keys are stripped.
 */
export const publicOrderDraftSchema = z.object({
  quoteToken: z.string().min(1).max(MAX_QUOTE_TOKEN_LENGTH),
  stopdesk: z.boolean(),
  codes: cartBodyShape.codes.unwrap().default([]),
  deviceId: z.uuid(),
  pageMs: timingSchema,
  formMs: timingSchema,
  fbp: z.string().max(FBP_MAX_LENGTH).optional(),
  /** The overweight fee the form showed, so intake can tell a buyer who saw a surcharge from one who did not. */
  overweightFeeShown: moneySchema,
  orderClient: orderClientSchema,
  orderItems: cartBodyShape.lines,
});

/** An order draft as a client writes it. */
export type PublicOrderDraftInput = z.input<typeof publicOrderDraftSchema>;
/** A parsed order draft: phone in E.164. */
export type PublicOrderDraft = z.output<typeof publicOrderDraftSchema>;

/**
 * The cart-quote request a draft stands for: its lines, destination, phone and codes. It equals the parsed body of the
 * quote that issued the draft's token, so the token's cart hash can be checked against it (D3309).
 */
export function quoteRequestOfDraft(draft: PublicOrderDraft): StorefrontCartQuoteBody {
  const { orderClient } = draft;
  return {
    lines: draft.orderItems.map(({ variantId, quantity }) => ({ variantId, quantity })),
    destination: { provinceCode: orderClient.provinceCode, townOns: orderClient.townOns, stopdesk: draft.stopdesk },
    phone: orderClient.phone,
    codes: [...draft.codes],
  };
}

/** `201` of `POST /api/store/orders`: the pending order and what the buyer pays; `mock` while P3.S4 is not wired. */
export const publicOrderAcceptedSchema = z.object({
  id: z.string().min(1),
  status: z.literal('pending'),
  total: moneySchema,
  shippingPrice: moneySchema,
  subtotal: moneySchema,
  discountTotal: moneySchema,
  mock: z.literal(true).optional(),
});

/** An accepted order. */
export type PublicOrderAccepted = z.output<typeof publicOrderAcceptedSchema>;

/** Error code of a draft whose token no longer matches its cart or prices. */
export const QUOTE_MISMATCH_CODE = 'QUOTE_MISMATCH';

/** `409` of `POST /api/store/orders`: the token went stale; `quote` is a fresh public quote of the same cart (D3315). */
export const orderQuoteMismatchSchema = z.object({
  code: z.literal(QUOTE_MISMATCH_CODE),
  quote: publicQuoteSchema,
});

/** A quote mismatch answer. */
export type OrderQuoteMismatch = z.output<typeof orderQuoteMismatchSchema>;
