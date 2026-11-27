import { describe, expect, it } from 'vitest';
import {
  BUYER_PHONE_FORMAT,
  buyerPhoneSchema,
  normalizeBuyerPhone,
  normalizeWith,
  type PhoneFormat,
} from '../../src/phone/phone';

describe('buyer phone normalisation (D3304)', () => {
  it.each([
    ['0551234567', '+213551234567'],
    ['05 51 23 45 67', '+213551234567'],
    ['05-51-23-45-67', '+213551234567'],
    ['05.51.23.45.67', '+213551234567'],
    ['+213551234567', '+213551234567'],
    ['+213 0551234567', '+213551234567'],
    ['00213551234567', '+213551234567'],
    ['213551234567', '+213551234567'],
    ['٠٥٥١٢٣٤٥٦٧', '+213551234567'],
    ['۰۶۶۱۲۳۴۵۶۷', '+213661234567'],
    [' 0771234567 ', '+213771234567'],
  ])('reads %j as the mobile %s', (input, e164) => {
    // Act
    const result = normalizeBuyerPhone(input);
    // Assert
    expect(result).toEqual({ ok: true, e164 });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['0251234567', 'not_mobile'],
    ['+213251234567', 'not_mobile'],
    ['055123456', 'length'],
    ['05512345678', 'length'],
    ['0', 'length'],
    ['abc', 'format'],
    ['05512a4567', 'format'],
    ['+33612345678', 'format'],
    ['551234567', 'format'],
  ] as const)('refuses %j as %s', (input, reason) => {
    // Act
    const result = normalizeBuyerPhone(input);
    // Assert
    expect(result).toEqual({ ok: false, reason });
  });

  it('follows the format data, not a rule written in code', () => {
    // Arrange
    const swapped: PhoneFormat = { ...BUYER_PHONE_FORMAT, mobilePrefixes: ['8'] };
    // Act
    const accepted = normalizeWith(swapped, '0812345678');
    const refused = normalizeWith(swapped, '0551234567');
    // Assert
    expect(accepted).toEqual({ ok: true, e164: '+213812345678' });
    expect(refused).toEqual({ ok: false, reason: 'not_mobile' });
  });

  it('takes the country code and length from the format too', () => {
    // Arrange
    const other: PhoneFormat = {
      countryCode: '216',
      trunkPrefix: '',
      mobilePrefixes: ['2', '5', '9'],
      nationalLength: 8,
    };
    // Act
    const result = normalizeWith(other, '+216 22 123 456');
    // Assert
    expect(result).toEqual({ ok: true, e164: '+21622123456' });
  });
});

describe('buyerPhoneSchema', () => {
  it('parses a typed mobile to E.164', () => {
    expect(buyerPhoneSchema.parse('0551234567')).toBe('+213551234567');
  });

  it('refuses a landline with the reason in the issue params', () => {
    // Act
    const result = buyerPhoneSchema.safeParse('0251234567');
    // Assert
    expect(result.success).toBe(false);
    const issue = result.error?.issues[0];
    expect(issue?.code === 'custom' ? issue.params : undefined).toEqual({ reason: 'not_mobile' });
  });

  it('refuses an input longer than any phone spelling before reading it', () => {
    expect(buyerPhoneSchema.safeParse('0'.repeat(200)).success).toBe(false);
  });
});
