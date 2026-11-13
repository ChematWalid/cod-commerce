import { describe, expect, it } from 'vitest';
import type { SalaryPaymentRepositoryPort } from '../../domain/ports/salary-payment-repository.port';
import { newId, salaryPayment, scopeA, scopeB, T0 } from '../support/builders';
import type { MakeHarness } from './repository-harness';

/** The behaviour every {@link SalaryPaymentRepositoryPort} adapter must have, tenant isolation included. */
export function describeSalaryPaymentRepositoryContract(
  name: string,
  make: MakeHarness<SalaryPaymentRepositoryPort>,
): void {
  describe(`${name} (SalaryPaymentRepositoryPort contract)`, () => {
    it('finds a payment by its idempotency key, in its business only', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const payment = salaryPayment(scopeA, newId());

      // Act
      await repo.insert(ctx, scopeA, payment);

      // Assert
      await expect(repo.findByIdempotencyKey(ctx, scopeA, payment.memberId, payment.idempotencyKey)).resolves.toEqual(
        payment,
      );
      await expect(
        repo.findByIdempotencyKey(ctx, scopeB, payment.memberId, payment.idempotencyKey),
      ).resolves.toBeUndefined();
      await expect(repo.ofMember(ctx, scopeB, payment.memberId)).resolves.toEqual([]);
    });

    it("refuses a second payment of one member under one key, but not another member's", async () => {
      // Arrange
      const { repo, ctx } = await make();
      const payment = salaryPayment(scopeA, newId(), { idempotencyKey: 'click-1' });
      await repo.insert(ctx, scopeA, payment);

      // Act
      await repo.insert(ctx, scopeA, salaryPayment(scopeA, newId(), { idempotencyKey: 'click-1' }));

      // Assert
      await expect(
        repo.insert(ctx, scopeA, salaryPayment(scopeA, payment.memberId, { idempotencyKey: 'click-1' })),
      ).rejects.toThrow();
    });

    it("lists a member's payments newest first", async () => {
      // Arrange
      const { repo, ctx } = await make();
      const memberId = newId();
      const older = salaryPayment(scopeA, memberId);
      const newer = salaryPayment(scopeA, memberId, { paidAt: new Date(T0.getTime() + 1000) });
      await repo.insert(ctx, scopeA, older);
      await repo.insert(ctx, scopeA, newer);

      // Act
      const payments = await repo.ofMember(ctx, scopeA, memberId);

      // Assert
      expect(payments).toEqual([newer, older]);
    });
  });
}
