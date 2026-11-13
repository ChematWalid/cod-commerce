import { describe, expect, it } from 'vitest';
import { FLAG_KEYS, FLAG_SEEDS, isFlagKey } from '../src/flags/flag-keys';

const DOTTED_KEY = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

describe('FLAG_KEYS', () => {
  it('names the four operational flags', () => {
    // Assert
    expect(FLAG_KEYS).toEqual({
      intakeSpool: 'intake.spool.enabled',
      inboundWebhooks: 'inbound-webhooks.enabled',
      ai: 'ai.enabled',
      capi: 'capi.enabled',
    });
  });

  it('recognises its own keys and nothing else', () => {
    // Assert
    expect(Object.values(FLAG_KEYS).every(isFlagKey)).toBe(true);
    expect(isFlagKey('nope.enabled')).toBe(false);
    expect(isFlagKey('')).toBe(false);
  });
});

describe('FLAG_SEEDS', () => {
  it('holds one seed per key, all dotted', () => {
    // Act
    const keys = FLAG_SEEDS.map((seed) => seed.key);

    // Assert
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual(Object.values(FLAG_KEYS).sort());
    for (const key of keys) expect(key).toMatch(DOTTED_KEY);
  });

  it('keeps every rollout percent an integer from 0 to 100', () => {
    for (const seed of FLAG_SEEDS) {
      expect(Number.isInteger(seed.rolloutPercent)).toBe(true);
      expect(seed.rolloutPercent).toBeGreaterThanOrEqual(0);
      expect(seed.rolloutPercent).toBeLessThanOrEqual(100);
    }
  });

  it('describes every flag in at most 200 characters and starts all of them on (D116)', () => {
    for (const seed of FLAG_SEEDS) {
      expect(seed.description.length).toBeGreaterThan(0);
      expect(seed.description.length).toBeLessThanOrEqual(200);
      expect(seed.defaultEnabled).toBe(true);
      expect(seed.rolloutPercent).toBe(100);
    }
  });
});
