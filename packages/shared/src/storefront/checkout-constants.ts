import type { BuyerPhoneRefusal } from '../phone/phone';

/** Longest wilaya code a shipping-quote body may carry; the geo data decides which codes exist (DATA OVER CONSTANTS). */
export const PROVINCE_CODE_MAX_LENGTH = 8;
/** A commune (ONS) code as text: digits only. */
export const TOWN_ONS_PATTERN = /^\d+$/;

/** Longest buyer name, address and note of the COD form. */
export const BUYER_NAME_MAX = 100;
export const BUYER_ADDRESS_MAX = 500;
export const BUYER_NOTE_MAX = 2000;

/** Longest Meta browser id (`_fbp` cookie) an order draft may carry. */
export const FBP_MAX_LENGTH = 128;
/** Most milliseconds a draft may report on the page or in the form: one day; more is a stale tab, not a buyer. */
export const ORDER_TIMING_MAX_MS = 86_400_000;

/** An ISO 4217 currency code, as a quote names its currency (D3312). */
export const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

/** How a buyer gets the parcel: at home or at a carrier desk (`stopdesk`). */
export const DELIVERY_TYPES = ['home', 'desk'] as const;

/** One of the {@link DELIVERY_TYPES}. */
export type DeliveryType = (typeof DELIVERY_TYPES)[number];

/** Why a non-phone field of the COD form is refused. */
export type CheckoutFieldRefusal = 'empty' | 'length';

/**
 * Every field error the COD form shows, by field; each pair has the message `checkout.error.<field>.<reason>`. The
 * phone reasons are those of the phone format reader.
 */
export const CHECKOUT_FIELD_ERRORS: {
  readonly name: readonly CheckoutFieldRefusal[];
  readonly phone: readonly BuyerPhoneRefusal[];
  readonly wilaya: readonly CheckoutFieldRefusal[];
  readonly commune: readonly CheckoutFieldRefusal[];
  readonly address: readonly CheckoutFieldRefusal[];
  readonly note: readonly CheckoutFieldRefusal[];
} = {
  name: ['empty', 'length'],
  phone: ['empty', 'not_mobile', 'length', 'format'],
  wilaya: ['empty'],
  commune: ['empty'],
  address: ['empty', 'length'],
  note: ['length'],
};

/** A field of the COD form. */
export type CheckoutField = keyof typeof CHECKOUT_FIELD_ERRORS;
