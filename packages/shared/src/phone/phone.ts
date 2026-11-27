import { z } from 'zod';
import phoneFormatData from './phone-format.json';

/**
 * How buyer phones are written in the platform's country (D3304): data, never code, so a new prefix or length is one
 * edit of `phone-format.json` (interim until #304 serves it in the store payload).
 */
export interface PhoneFormat {
  /** The country calling code, without `+` or `00`. */
  readonly countryCode: string;
  /** The national trunk prefix typed before a number at home (`0`), or `''` for none. */
  readonly trunkPrefix: string;
  /** First digits (after the trunk) of a mobile number; a buyer phone must be a mobile. */
  readonly mobilePrefixes: readonly string[];
  /** Digits of a number as typed at home, trunk prefix included. */
  readonly nationalLength: number;
}

const digitsSchema = z.string().regex(/^\d*$/);

/** The shape `phone-format.json` must have; checked when the module loads, so a bad edit fails fast. */
export const phoneFormatSchema = z.strictObject({
  countryCode: digitsSchema.min(1),
  trunkPrefix: digitsSchema,
  mobilePrefixes: z.array(digitsSchema.min(1)).min(1),
  nationalLength: z.number().int().positive(),
});

/** The platform's buyer phone format, read from `phone-format.json`. */
export const BUYER_PHONE_FORMAT: PhoneFormat = phoneFormatSchema.parse(phoneFormatData);

/** Why a typed phone is not a buyer mobile. */
export const BUYER_PHONE_REFUSALS = ['empty', 'not_mobile', 'length', 'format'] as const;

/** One of the {@link BUYER_PHONE_REFUSALS}. */
export type BuyerPhoneRefusal = (typeof BUYER_PHONE_REFUSALS)[number];

/** A typed phone read as one E.164 mobile, or the reason it cannot be. */
export type BuyerPhoneResult = { ok: true; e164: string } | { ok: false; reason: BuyerPhoneRefusal };

/** Longest phone text read at all: far past any spelling, so a pasted essay is refused before any work. */
export const BUYER_PHONE_INPUT_MAX = 32;

/** Separators buyers type inside a number. */
const SEPARATORS = /[\s.-]/gu;
/** Arabic-Indic (`٠`) and extended Arabic-Indic (`۰`) zeros; the nine digits after each follow in order. */
const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;
const DIGITS_IN_BASE = 10;
const ARABIC_DIGIT = /[٠-٩۰-۹]/gu;
const INTERNATIONAL_PREFIX = '+';
const INTERNATIONAL_DIAL_PREFIX = '00';
const PLAIN_NUMBER = /^\+?\d+$/;

function latinDigit(digit: string): string {
  const code = digit.codePointAt(0) ?? 0;
  const zero = code >= EXTENDED_ARABIC_INDIC_ZERO ? EXTENDED_ARABIC_INDIC_ZERO : ARABIC_INDIC_ZERO;
  return String((code - zero) % DIGITS_IN_BASE);
}

function compactOf(input: string): string {
  return input.replace(ARABIC_DIGIT, latinDigit).replace(SEPARATORS, '');
}

function withoutTrunk(format: PhoneFormat, digits: string): string {
  return format.trunkPrefix !== '' && digits.startsWith(format.trunkPrefix)
    ? digits.slice(format.trunkPrefix.length)
    : digits;
}

/** The subscriber digits (no country code, no trunk) of a compact number, or `null` when it is not of this country. */
function subscriberOf(format: PhoneFormat, compact: string): string | null {
  const subscriberLength = format.nationalLength - format.trunkPrefix.length;
  const international = compact.startsWith(INTERNATIONAL_PREFIX)
    ? compact.slice(INTERNATIONAL_PREFIX.length)
    : compact.startsWith(INTERNATIONAL_DIAL_PREFIX)
      ? compact.slice(INTERNATIONAL_DIAL_PREFIX.length)
      : null;
  if (international !== null) {
    return international.startsWith(format.countryCode)
      ? withoutTrunk(format, international.slice(format.countryCode.length))
      : null;
  }
  if (compact.startsWith(format.countryCode) && compact.length >= format.countryCode.length + subscriberLength) {
    return withoutTrunk(format, compact.slice(format.countryCode.length));
  }
  if (format.trunkPrefix === '') return compact;
  return compact.startsWith(format.trunkPrefix) ? compact.slice(format.trunkPrefix.length) : null;
}

/**
 * Reads a typed buyer phone with `format`: separators (spaces, dashes, dots) dropped, Arabic-Indic digits read as
 * Latin, and the trunk, `+<country>`, `00<country>` and bare `<country>` spellings accepted. Only a mobile of the
 * national length passes.
 */
export function normalizeWith(format: PhoneFormat, input: string): BuyerPhoneResult {
  if (input.trim() === '') return { ok: false, reason: 'empty' };
  const compact = compactOf(input);
  if (!PLAIN_NUMBER.test(compact)) return { ok: false, reason: 'format' };
  const subscriber = subscriberOf(format, compact);
  if (subscriber === null) return { ok: false, reason: 'format' };
  const subscriberLength = format.nationalLength - format.trunkPrefix.length;
  const mobile = format.mobilePrefixes.some((prefix) => subscriber.startsWith(prefix));
  if (subscriber !== '' && !mobile) return { ok: false, reason: 'not_mobile' };
  if (subscriber.length !== subscriberLength) return { ok: false, reason: 'length' };
  return { ok: true, e164: `${INTERNATIONAL_PREFIX}${format.countryCode}${subscriber}` };
}

/** {@link normalizeWith} the platform's {@link BUYER_PHONE_FORMAT}. */
export function normalizeBuyerPhone(input: string): BuyerPhoneResult {
  return normalizeWith(BUYER_PHONE_FORMAT, input);
}

/** A buyer mobile as typed, out as E.164; a refusal carries its reason in the issue's `params.reason`. */
export const buyerPhoneSchema = z.string().transform((input, context) => {
  const result: BuyerPhoneResult =
    input.length > BUYER_PHONE_INPUT_MAX ? { ok: false, reason: 'length' } : normalizeBuyerPhone(input);
  if (result.ok) return result.e164;
  context.addIssue({ code: 'custom', message: result.reason, params: { reason: result.reason } });
  return z.NEVER;
});
