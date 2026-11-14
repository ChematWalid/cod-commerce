import { describe, expect, it } from 'vitest';
import { previewValue } from '../../src/errors/value-preview';
import { InvalidSnowflakeError, InvalidBusinessIdError } from '../../src/index';

const HOSTILE = `\u001b[31m${'x'.repeat(10_000)}`;

describe('previewValue', () => {
  it('quotes a short printable value unchanged', () => {
    expect(previewValue('abc')).toBe('"abc"');
  });

  it('bounds a long value and escapes control characters', () => {
    // Act
    const preview = previewValue(HOSTILE);

    // Assert
    expect(preview).not.toContain('\u001b');
    expect(preview.length).toBeLessThan(60);
    expect(preview.endsWith('…')).toBe(true);
  });

  it('names the type of a value that is not a string', () => {
    expect(previewValue(undefined)).toBe('(undefined)');
    expect(previewValue(null)).toBe('(null)');
    expect(previewValue(5)).toBe('(number)');
  });
});

describe('id error messages', () => {
  it('bound and escape a forged business id', () => {
    const message = new InvalidBusinessIdError(HOSTILE).message;

    expect(message).not.toContain('\u001b');
    expect(message.length).toBeLessThan(100);
  });

  it('bound and escape a forged snowflake id', () => {
    const message = new InvalidSnowflakeError(HOSTILE).message;

    expect(message).not.toContain('\u001b');
    expect(message.length).toBeLessThan(100);
  });
});
