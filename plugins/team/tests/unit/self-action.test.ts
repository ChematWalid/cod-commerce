import { describe, expect, it } from 'vitest';
import { SelfActionError } from '../../domain/errors';
import { assertNotSelf } from '../../domain/self-action';
import { invitedMember, scopeA } from '../support/builders';

describe('assertNotSelf', () => {
  it("refuses an action on the actor's own member row", () => {
    // Arrange
    const member = invitedMember(scopeA, { status: 'active', administratorId: 7 });

    // Act and assert
    expect(() => {
      assertNotSelf(7, member);
    }).toThrow(SelfActionError);
  });

  it("allows an action on someone else's row, or on an invited member without an account", () => {
    // Act and assert
    expect(() => {
      assertNotSelf(7, invitedMember(scopeA, { status: 'active', administratorId: 8 }));
      assertNotSelf(7, invitedMember(scopeA));
    }).not.toThrow();
  });
});
