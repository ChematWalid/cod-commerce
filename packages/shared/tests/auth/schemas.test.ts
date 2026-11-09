import { describe, expect, it } from 'vitest';
import {
  AUTH_OPAQUE_TOKEN_MAX_LENGTH,
  emailSchema,
  otpSchema,
  passwordSchema,
  phoneE164Schema,
  registerAccountStepSchema,
  registerBusinessStepSchema,
  registerMerchantSchema,
  registerStoreStepSchema,
  updateAccountProfileSchema,
} from '../../src/index';

const account = { email: ' Owner@Shop.test ', password: 'correct-horse', firstName: 'Amine', lastName: 'B' };
const store = { storeName: 'Boutique', subdomain: 'boutique', storeLanguage: 'ar' };

describe('passwordSchema', () => {
  it.each([
    ['7 bytes', 'a'.repeat(7), false],
    ['8 bytes', 'a'.repeat(8), true],
    ['72 bytes', 'a'.repeat(72), true],
    ['73 bytes', 'a'.repeat(73), false],
    ['40 Arabic characters (80 bytes)', 'ع'.repeat(40), false],
    ['36 Arabic characters (72 bytes)', 'ع'.repeat(36), true],
    ['a NUL byte', 'abcdefg\0h', false],
    ['3 Arabic characters (6 bytes)', 'ع'.repeat(3), false],
    ['4 Arabic characters (8 bytes)', 'ع'.repeat(4), true],
  ])('%s', (_label, value, ok) => {
    expect(passwordSchema.safeParse(value).success).toBe(ok);
  });
});

describe('emailSchema', () => {
  it('trims and lowercases', () => {
    expect(emailSchema.parse(' A@B.test ')).toBe('a@b.test');
  });
  it('rejects a malformed address', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });
});

describe('otpSchema', () => {
  it('accepts six digits only', () => {
    expect(otpSchema.safeParse('012345').success).toBe(true);
    expect(otpSchema.safeParse('12345').success).toBe(false);
    expect(otpSchema.safeParse('12345a').success).toBe(false);
  });
});

describe('phoneE164Schema', () => {
  it.each([
    ['0555123456', '+213555123456'],
    ['+213555123456', '+213555123456'],
    ['0555 12 34 56', '+213555123456'],
    ['+213 0555123456', '+213555123456'],
    ['00213555123456', '+213555123456'],
    ['0033612345678', '+33612345678'],
  ])('turns %s into %s', (raw, expected) => {
    expect(phoneE164Schema.parse(raw)).toBe(expected);
  });
  it.each(['555', '+12', '+1234567890123456', 'abc'])('rejects %s', (raw) => {
    expect(phoneE164Schema.safeParse(raw).success).toBe(false);
  });
});

describe('registration schemas', () => {
  it('caps challengeToken and oauthTicket', () => {
    const base = { ...account, businessName: 'A', ...store };
    expect(
      registerMerchantSchema.safeParse({ ...base, challengeToken: 'x'.repeat(AUTH_OPAQUE_TOKEN_MAX_LENGTH) }).success,
    ).toBe(true);
    expect(
      registerMerchantSchema.safeParse({ ...base, challengeToken: 'x'.repeat(AUTH_OPAQUE_TOKEN_MAX_LENGTH + 1) })
        .success,
    ).toBe(false);
    expect(
      registerMerchantSchema.safeParse({ ...base, oauthTicket: 'x'.repeat(AUTH_OPAQUE_TOKEN_MAX_LENGTH + 1) }).success,
    ).toBe(false);
  });

  it('normalises the email in step 1', () => {
    expect(registerAccountStepSchema.parse(account).email).toBe('owner@shop.test');
  });
  it('requires a business name in step 2', () => {
    expect(registerBusinessStepSchema.safeParse({ businessName: ' ' }).success).toBe(false);
    expect(registerBusinessStepSchema.parse({ businessName: ' Acme ' }).businessName).toBe('Acme');
  });
  it('rejects an unsupported store language in step 3', () => {
    expect(registerStoreStepSchema.safeParse({ ...store, storeLanguage: 'de' }).success).toBe(false);
  });
  it('accepts the full input and defaults emailLocale to the store language', () => {
    const parsed = registerMerchantSchema.parse({ ...account, businessName: 'Acme', ...store });
    expect(parsed).toMatchObject({ email: 'owner@shop.test', emailLocale: 'ar' });
  });
  it('rejects a weak password in the full input', () => {
    expect(
      registerMerchantSchema.safeParse({ ...account, password: 'short', businessName: 'A', ...store }).success,
    ).toBe(false);
  });
});

describe('updateAccountProfileSchema', () => {
  const names = { firstName: ' Amine ', lastName: 'Benali' };

  it('stores a national phone in E.164 and trims the names', () => {
    expect(updateAccountProfileSchema.parse({ ...names, phone: '0555123456' })).toEqual({
      firstName: 'Amine',
      lastName: 'Benali',
      phone: '+213555123456',
    });
  });
  it.each([undefined, null, '', '  '])('reads %j as no phone', (phone) => {
    expect(updateAccountProfileSchema.parse({ ...names, phone }).phone).toBeNull();
  });
  it('rejects a phone that is not a number and an empty name', () => {
    expect(updateAccountProfileSchema.safeParse({ ...names, phone: 'abc' }).success).toBe(false);
    expect(updateAccountProfileSchema.safeParse({ firstName: ' ', lastName: 'B' }).success).toBe(false);
  });
});
