import { IDEMPOTENCY_KEY_MAX_LENGTH } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../../domain/errors';
import { createSalaryPayment } from '../../domain/salary-payment';
import { invitedMember, newId, scopeA, T0 } from '../support/builders';

const pay = (idempotencyKey: string, amount = 30_000) =>
  createSalaryPayment({
    id: newId(),
    scope: scopeA,
    member: invitedMember(scopeA, { status: 'active', baseSalary: amount }),
    idempotencyKey,
    paidByAdministratorId: 1,
    now: T0,
  });

describe('createSalaryPayment', () => {
  it("pays the member's base salary under the client key", () => {
    // Act
    const payment = pay('click-1', 45_000);

    // Assert
    expect(payment).toMatchObject({ amount: 45_000, idempotencyKey: 'click-1', paidAt: T0 });
  });

  it.each(['', 'k'.repeat(IDEMPOTENCY_KEY_MAX_LENGTH + 1)])('refuses the idempotency key %j', (key) => {
    // Act and assert
    expect(() => pay(key)).toThrow(InvalidInputError);
  });
});
