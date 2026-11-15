import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../../domain/token/canonical';

describe('canonicalJson', () => {
  it('sorts object keys at every depth', () => {
    // Arrange
    const value = { b: 1, a: { d: [{ z: true, y: null }], c: 'x' } };

    // Act
    const json = canonicalJson(value);

    // Assert
    expect(json).toBe('{"a":{"c":"x","d":[{"y":null,"z":true}]},"b":1}');
  });

  it('keeps the order of array items', () => {
    // Arrange
    const value = [3, 1, 2];

    // Act
    const json = canonicalJson(value);

    // Assert
    expect(json).toBe('[3,1,2]');
  });

  it('gives one string for two objects that differ only in key order', () => {
    // Arrange
    const left = { channel: 'storefront', codes: ['A'] };
    const right = { codes: ['A'], channel: 'storefront' };

    // Act
    const results = [canonicalJson(left), canonicalJson(right)];

    // Assert
    expect(results[0]).toBe(results[1]);
  });

  it('leaves out keys whose value is undefined', () => {
    // Arrange
    const value = { a: 1, b: undefined };

    // Act
    const json = canonicalJson(value);

    // Assert
    expect(json).toBe('{"a":1}');
  });
});
