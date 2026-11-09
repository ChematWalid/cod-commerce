import { z } from 'zod';
import { PLATFORM_LANGUAGE_CODES } from '../platform/platform-defaults';
import { AUTH_OPAQUE_TOKEN_MAX_LENGTH, OTP_LENGTH, PASSWORD_MAX_BYTES, PASSWORD_MIN_BYTES } from './constants';
import { normalizeEmail } from './normalize-email';

const NAME_MAX_LENGTH = 100;
const PHONE_DIGITS = /^\+\d{8,15}$/;
const ALGERIA_PREFIX = '+213';
const NATIONAL_TRUNK = '0';
const PHONE_SEPARATORS = /[\s.\-()]/g;
const NUL = '\0';
const INTERNATIONAL_PREFIX = '00';
const utf8Bytes = (value: string): number => new TextEncoder().encode(value).length;

/** A password of 8 to 72 UTF-8 bytes; bytes, not characters, because bcrypt reads bytes. */
export const passwordSchema = z
  .string()
  .refine((value) => utf8Bytes(value) >= PASSWORD_MIN_BYTES, { message: 'auth.password-policy' })
  .refine((value) => utf8Bytes(value) <= PASSWORD_MAX_BYTES, { message: 'auth.password-policy' })
  .refine((value) => !value.includes(NUL), { message: 'auth.password-policy' });

/** A trimmed, lowercased email address. */
export const emailSchema = z.string().transform(normalizeEmail).pipe(z.email());

/** The numeric code from a verification email. */
export const otpSchema = z.string().regex(new RegExp(`^\\d{${String(OTP_LENGTH)}}$`));

function toInternationalPhone(raw: string): string {
  const compact = raw.trim().replace(PHONE_SEPARATORS, '');
  if (compact.startsWith(INTERNATIONAL_PREFIX)) return `+${compact.slice(INTERNATIONAL_PREFIX.length)}`;
  if (compact.startsWith(ALGERIA_PREFIX + NATIONAL_TRUNK))
    return ALGERIA_PREFIX + compact.slice(ALGERIA_PREFIX.length + 1);
  if (compact.startsWith(NATIONAL_TRUNK)) return `${ALGERIA_PREFIX}${compact.slice(1)}`;
  return compact;
}

/**
 * A phone number in E.164. A national number with a leading 0 is read as Algerian (+213), a leading 00
 * as +, and a trunk 0 typed after +213 is dropped.
 */
export const phoneE164Schema = z.string().transform(toInternationalPhone).pipe(z.string().regex(PHONE_DIGITS));

const nameSchema = z.string().trim().min(1).max(NAME_MAX_LENGTH);
const opaqueTokenSchema = z.string().max(AUTH_OPAQUE_TOKEN_MAX_LENGTH);
const languageSchema = z.enum(PLATFORM_LANGUAGE_CODES);

/**
 * The profile form: both names, and a phone that may be left out or cleared (an empty string clears it).
 * The phone comes out in E.164 or as null.
 */
export const updateAccountProfileSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  phone: z
    .union([z.string().trim().length(0), phoneE164Schema])
    .nullish()
    .transform((phone) => (phone == null || phone === '' ? null : phone)),
});

export type UpdateAccountProfileInput = z.input<typeof updateAccountProfileSchema>;
export type UpdateAccountProfileCommand = z.output<typeof updateAccountProfileSchema>;

/** Wizard step 1. */
export const registerAccountStepSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
});

/** Wizard step 2. */
export const registerBusinessStepSchema = z.object({ businessName: nameSchema });

/** Wizard step 1 after a provider sign-in: the provider stands in for the password. */
export const registerOAuthAccountStepSchema = registerAccountStepSchema.omit({ password: true });

/** Wizard step 3. The subdomain's availability is checked separately, against the database. */
export const registerStoreStepSchema = z.object({
  storeName: nameSchema,
  subdomain: z.string().trim().toLowerCase(),
  storeLanguage: languageSchema,
});

/** The whole sign-up. `emailLocale` defaults to the store language. */
export const registerMerchantSchema = registerAccountStepSchema
  .extend({ password: passwordSchema.optional() })
  .extend(registerBusinessStepSchema.shape)
  .extend(registerStoreStepSchema.shape)
  .extend({
    emailLocale: languageSchema.optional(),
    challengeToken: opaqueTokenSchema.optional(),
    oauthTicket: opaqueTokenSchema.optional(),
  })
  .refine((input) => input.password !== undefined || input.oauthTicket !== undefined, { path: ['password'] })
  .transform((input) => ({ ...input, emailLocale: input.emailLocale ?? input.storeLanguage }));

export type RegisterMerchantInput = z.input<typeof registerMerchantSchema>;
export type RegisterMerchantCommand = z.output<typeof registerMerchantSchema>;
