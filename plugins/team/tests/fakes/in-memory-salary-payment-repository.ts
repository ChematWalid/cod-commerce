import type { Snowflake, TenantScope } from '@cod/shared';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { SalaryPaymentRepositoryPort } from '../../domain/ports/salary-payment-repository.port';
import type { SalaryPayment } from '../../domain/salary-payment';

/** Salary payments in memory, unique per member and idempotency key as the table is; it passes the contract. */
export class InMemorySalaryPaymentRepository implements SalaryPaymentRepositoryPort {
  readonly rows: SalaryPayment[] = [];

  insert(_ctx: OperationContext, scope: TenantScope, payment: SalaryPayment): Promise<void> {
    const taken = this.rows.some(
      (row) =>
        row.businessId === scope.businessId &&
        row.memberId === payment.memberId &&
        row.idempotencyKey === payment.idempotencyKey,
    );
    if (taken) return Promise.reject(new Error('duplicate key value violates unique constraint "salary_payment_key"'));
    this.rows.push({ ...payment, businessId: scope.businessId });
    return Promise.resolve();
  }

  findByIdempotencyKey(
    _ctx: OperationContext,
    scope: TenantScope,
    memberId: Snowflake,
    idempotencyKey: string,
  ): Promise<SalaryPayment | undefined> {
    return Promise.resolve(
      this.rows.find(
        (row) =>
          row.businessId === scope.businessId && row.memberId === memberId && row.idempotencyKey === idempotencyKey,
      ),
    );
  }

  ofMember(_ctx: OperationContext, scope: TenantScope, memberId: Snowflake): Promise<readonly SalaryPayment[]> {
    const rows = this.rows.filter((row) => row.businessId === scope.businessId && row.memberId === memberId);
    return Promise.resolve(
      [...rows].sort((left, right) => right.paidAt.getTime() - left.paidAt.getTime() || (left.id < right.id ? 1 : -1)),
    );
  }
}
