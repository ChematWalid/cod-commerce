import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { restStatusOf } from '../../api/error-mapping';
import { MemberNotFoundError, MemberSuspendedError, PrivilegeExceededError } from '../../domain/errors';

describe('restStatusOf', () => {
  it.each([
    ['a deactivated member', new MemberSuspendedError(), HttpStatus.CONFLICT],
    ['a member not found', new MemberNotFoundError(), HttpStatus.NOT_FOUND],
    ['an escalation', new PrivilegeExceededError(), HttpStatus.FORBIDDEN],
  ] as const)('maps %s', (_name, error, status) => {
    // Act
    const mapped = restStatusOf(error);

    // Assert
    expect(mapped).toBe(status);
  });
});
