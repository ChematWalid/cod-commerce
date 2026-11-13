import { ACTIVITY_ENTITY_TYPES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { targetNameOf, targetTypeMessageIdOf } from '../../dashboard/activity-target';

describe('activity target', () => {
  it('names every entity type rbac and Team write with a translated message', () => {
    // Act
    const messageIds = Object.values(ACTIVITY_ENTITY_TYPES).map(targetTypeMessageIdOf);

    // Assert
    expect(messageIds).toEqual([
      'rbac.target-role',
      'rbac.target-member',
      'rbac.target-team-member',
      'rbac.target-commission',
    ]);
  });

  it('gives no message to an entity type it does not know', () => {
    // Act and assert
    expect(targetTypeMessageIdOf('something-else')).toBeNull();
  });

  it("names a commission row by the config's name", () => {
    // Arrange
    const diff = { commissionConfigId: '7', name: 'Confirmers', changedFields: [] };

    // Act and assert
    expect(targetNameOf(diff)).toBe('Confirmers');
  });

  it("names a team member row by the member's display name", () => {
    // Arrange
    const diff = { memberId: '7', displayName: 'Nadia Saidi', changedFields: [] };

    // Act and assert
    expect(targetNameOf(diff)).toBe('Nadia Saidi');
  });

  it('names a renamed role by its new name', () => {
    // Act and assert
    expect(targetNameOf({ name: { before: 'Old', after: 'New' } })).toBe('New');
  });

  it('gives no name to an invited member who has none yet', () => {
    // Act and assert
    expect(targetNameOf({ memberId: '7', displayName: null, changedFields: [] })).toBeNull();
  });
});
