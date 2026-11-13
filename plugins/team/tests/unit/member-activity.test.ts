import { MEMBER_NAME_MAX_LENGTH, teamMemberActivityDiffSchema, toSnowflake } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { activityNameOf, memberActivityDiff } from '../../domain/member-activity';

describe('activityNameOf', () => {
  it('joins the names of a member and gives null to a member with none yet', () => {
    // Act and assert
    expect(activityNameOf({ firstName: 'Nadia', lastName: 'Saidi' })).toBe('Nadia Saidi');
    expect(activityNameOf({ firstName: null, lastName: null })).toBeNull();
  });

  it('never names a member by something that looks like an address (D216)', () => {
    // Act and assert
    expect(activityNameOf({ firstName: 'nadia@example.test', lastName: 'Saidi' })).toBeNull();
  });

  it('cuts two long names to the longest name a diff may carry', () => {
    // Arrange
    const long = 'n'.repeat(MEMBER_NAME_MAX_LENGTH);

    // Act
    const diff = memberActivityDiff({ id: toSnowflake('1'), firstName: long, lastName: long }, ['status']);

    // Assert
    expect(teamMemberActivityDiffSchema.parse(diff).displayName).toHaveLength(MEMBER_NAME_MAX_LENGTH);
  });
});
