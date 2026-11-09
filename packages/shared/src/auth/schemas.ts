import { z } from 'zod';
import { PLATFORM_LANGUAGE_CODES } from '../platform/platform-defaults';
import { OTP_LENGTH, PASSWORD_MAX_BYTES, PASSWORD_MIN_BYTES } from './constants';
import { normalizeEmail } from './normalize-email';

const NAME_MAX_LENGTH = 100;
const PHONE_DIGITS = /^\+\d{8,15}$/;
const ALGERIA_PREFIX = '+213';
const NATIONAL_TRUNK = '0';
const PHONE_SEPARATORS = /[\s.\-()]/g;
const utf8Bytes = (value: string): number => new TextEncoder().encode(value).length;

/** A password of 8 to 72 UTF-8 bytes; bytes, not characters, because bcrypt reads bytes. */
export const passwordSchema = z
  .string()
  .refine((value) => utf8Bytes(value) >= PASSWORD_MIN_BYTES, { message: 'auth.password-policy' })
  .refine((value) => utf8Bytes(value) <= PASSWORD_MAX_BYTES, { message: 'auth.password-policy' });

/** A trimmed, lowercased email address. */
export const emailSchema = z.string().transform(normalizeEmail).pipe(z.email());

/** The numeric code from a verification email. */
export const otpSchema = z.string().regex(new RegExp(`^\\d{${String(OTP_LENGTH)}}$`));

/** A phone number in E.164. A national number with a leading 0 is read as Algerian (+213). */
export const phoneE164Schema = z
  .string()
  .transform((raw) => {
    const compact = raw.trim().replace(PHONE_SEPARATORS, '');
    return compact.startsWith(NATIONAL_TRUNK) ? `${ALGERIA_PREFIX}${compact.slice(1)}` : compact;
  })
  .pipe(z.string().regex(PHONE_DIGITS));

const nameSchema = z.string().trim().min(1).max(NAME_MAX_LENGTH);
const languageSchema = z.enum(PLATFORM_LANGUAGE_CODES);

/** Wizard step 1. */
export const registerAccountStepSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
});

/** Wizard step 2. */
export const registerBusinessStepSchema = z.object({ businessName: nameSchema });

/** Wizard step 3. The subdomain's availability is checked separately, against the database. */
export const registerStoreStepSchema = z.object({
  storeName: nameSchema,
  subdomain: z.string().trim().toLowerCase(),
  storeLanguage: languageSchema,
});

/** The whole sign-up. `emailLocale` defaults to the store language. */
export const registerMerchantSchema = registerAccountStepSchema
  .extend(registerBusinessStepSchema.shape)
  .extend(registerStoreStepSchema.shape)
  .extend({
    emailLocale: languageSchema.optional(),
    challengeToken: z.string().optional(),
    oauthTicket: z.string().optional(),
  })
  .transform((input) => ({ ...input, emailLocale: input.emailLocale ?? input.storeLanguage }));

export type RegisterMerchantInput = z.input<typeof registerMerchantSchema>;
export type RegisterMerchantCommand = z.output<typeof registerMerchantSchema>;
