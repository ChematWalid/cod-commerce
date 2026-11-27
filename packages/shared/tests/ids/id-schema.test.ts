import { describe, expect, it } from 'vitest';
import { vendureIdStringSchema } from '../../src/collections/fields';
import { coreIdSchema, idSchema } from '../../src/index';

describe('idSchema (ADR 0003)', () => {
  it('accepts an id above 2^53 and keeps its exact digits', () => {
    // Arrange
    const beyondSafeInteger = '9007199254740993';

    // Act
    const result = idSchema.safeParse(beyondSafeInteger);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toBe(beyondSafeInteger);
  });

  it('accepts the largest bigint id', () => {
    expect(idSchema.safeParse('9223372036854775807').success).toBe(true);
  });

  it.each([
    ['zero', '0'],
    ['a leading zero', '01'],
    ['a sign', '-1'],
    ['an exponent', '1e3'],
    ['a leading space', ' 1'],
    ['20 digits', '12345678901234567890'],
    ['19 digits above the bigint range', '9223372036854775808'],
    ['an empty string', ''],
  ])('refuses %s', (_name, value) => {
    expect(idSchema.safeParse(value).success).toBe(false);
  });

  it('refuses a number, even a small one', () => {
    expect(idSchema.safeParse(1).success).toBe(false);
  });
});

describe('coreIdSchema', () => {
  it('is the Vendure id schema itself, not a fork', () => {
    expect(coreIdSchema).toBe(vendureIdStringSchema);
  });

  it('accepts a Vendure id and refuses one past the int column', () => {
    expect(coreIdSchema.safeParse('42').success).toBe(true);
    expect(coreIdSchema.safeParse('2147483648').success).toBe(false);
  });
});
