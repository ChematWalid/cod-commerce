import { describe, expect, it } from 'vitest';
import { nextLockoutSeconds } from '../../domain/lockout';
import { RATE_LIMIT_POLICIES } from '../../domain/policies';
import { takeToken } from '../../domain/token-bucket';

describe('RATE_LIMIT_POLICIES', () => {
  it('fixes the capacities of D29', () => {
    expect(
      Object.fromEntries(Object.entries(RATE_LIMIT_POLICIES).map(([name, p]) => [name, [p.capacity, p.windowSeconds]])),
    ).toEqual({
      'login-pair': [10, 60],
      'login-account': [10, 60],
      'login-ip': [60, 60],
      'reset-account': [10, 60],
      'reset-ip': [60, 60],
      'token-redeem-ip': [60, 60],
      'otp-account': [10, 60],
      'otp-ip': [60, 60],
      'otp-account-daily': [50, 86_400],
      'current-password-account': [10, 60],
      'current-password-ip': [60, 60],
      'register-ip': [20, 3600],
      'subdomain-ip': [60, 60],
      'provinces-ip': [120, 60],
      'invitation-accept-ip': [60, 60],
      'team-invite-business': [100, 3600],
      'team-invite-actor': [30, 3600],
      'team-resend-actor': [30, 3600],
      'catalog-media-business': [1000, 3600],
      'catalog-media-actor': [120, 3600],
      'collections-preview-actor': [30, 60],
      'collections-rule-options-actor': [30, 60],
      'catalog-import-actor': [30, 3600],
      'catalog-import-business': [200, 3600],
      'catalog-export-business': [120, 3600],
      'catalog-scrape-actor': [60, 3600],
      'catalog-scrape-business': [300, 3600],
      'catalog-bulk-edit-actor': [120, 3600],
      'catalog-bulk-edit-business': [600, 3600],
      'catalog-pack-preview-actor': [600, 3600],
      'storefront-render': [6000, 60],
      'storefront-read': [600, 60],
      'storefront-quote': [120, 60],
      'storefront-quote-store': [3000, 60],
    });
  });

  it('keeps the storefront quotes limiting from memory during an outage, because each one reads the DB (D3302)', () => {
    // Act
    const outages = [
      RATE_LIMIT_POLICIES['storefront-quote'].outage,
      RATE_LIMIT_POLICIES['storefront-quote-store'].outage,
    ];

    // Assert
    expect(outages).toEqual(['in-process', 'in-process']);
  });

  it('keeps credential policies limiting during an outage and lets the others fail open (D31)', () => {
    const failOpen = Object.entries(RATE_LIMIT_POLICIES)
      .filter(([, policy]) => policy.outage === 'open')
      .map(([name]) => name);

    expect(failOpen.sort()).toEqual([
      'provinces-ip',
      'register-ip',
      'storefront-read',
      'storefront-render',
      'subdomain-ip',
    ]);
  });
});

describe('takeToken', () => {
  const policy = RATE_LIMIT_POLICIES['register-ip'];

  it('starts from a full bucket', () => {
    expect(takeToken(undefined, policy, 0).state.tokens).toBe(policy.capacity - 1);
  });

  it('does not charge a refused request, so the wait does not grow', () => {
    // Arrange
    const empty = { tokens: 0, updatedAtMs: 0 };

    // Act
    const first = takeToken(empty, policy, 0);
    const second = takeToken(first.state, policy, 0);

    // Assert: 20 per hour refills a token every 180 s
    expect(first.decision).toEqual({ allowed: false, retryAfterSeconds: 180, exhausted: true });
    expect(second.decision).toEqual(first.decision);
  });

  it('never refills past capacity or on a clock that went backwards', () => {
    // Arrange
    const state = { tokens: 5, updatedAtMs: 10_000 };

    // Act
    const backwards = takeToken(state, policy, 0);
    const longIdle = takeToken(state, policy, 10_000 + 365 * 24 * 3600 * 1000);

    // Assert
    expect(backwards.state.tokens).toBe(4);
    expect(longIdle.state.tokens).toBe(policy.capacity - 1);
  });
});

describe('nextLockoutSeconds', () => {
  it.each([
    [0, 60],
    [60, 120],
    [1920, 3600],
    [3600, 3600],
  ])('follows %i s with %i s', (previous, expected) => {
    expect(nextLockoutSeconds(previous)).toBe(expected);
  });
});

describe('takeToken clock', () => {
  it('does not let a stamp from the future freeze refill (RL-5)', () => {
    const policy = RATE_LIMIT_POLICIES['login-pair'];
    const nowMs = 1_700_000_000_000;
    const fromAFastClock = { tokens: 0, updatedAtMs: nowMs + 86_400_000 };

    const atRealTime = takeToken(fromAFastClock, policy, nowMs);
    const sixSecondsLater = takeToken(atRealTime.state, policy, nowMs + 6000);

    expect(sixSecondsLater.decision.allowed).toBe(true);
  });
});
