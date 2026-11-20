import type { RequestContext } from '@vendure/core';
import { describe, expect, it, vi } from 'vitest';
import { MembershipActions, type MembershipUseCases } from '../../api/membership-actions';

/** A request the tenant guard never resolved: no business, no active store. */
const ctxWithoutStore = {} as RequestContext;

describe('MembershipActions.slugAvailability', () => {
  it('refuses a request without an active store before checking the slug (D2314)', async () => {
    // Arrange
    const check = vi.fn();
    const actions = new MembershipActions({ slugs: { check } } as unknown as MembershipUseCases);

    // Act
    const answer = actions.slugAvailability(ctxWithoutStore, { slug: 'summer' });

    // Assert
    await expect(answer).rejects.toThrow();
    expect(check).not.toHaveBeenCalled();
  });
});
