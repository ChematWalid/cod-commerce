import type { Snowflake, TenantScope } from '@cod/shared';
import type { SalaryPayment } from '../salary-payment';
import type { OperationContext } from './operation-context';

/** Where salary payments are kept, confined to `scope.businessId`. */
export interface SalaryPaymentRepositoryPort {
  /** Stores a payment; rejects a second payment of the member under the same idempotency key (D212). */
  insert(ctx: OperationContext, scope: TenantScope, payment: SalaryPayment): Promise<void>;

  /** The member's payment booked under `idempotencyKey`, or `undefined`. */
  findByIdempotencyKey(
    ctx: OperationContext,
    scope: TenantScope,
    memberId: Snowflake,
    idempotencyKey: string,
  ): Promise<SalaryPayment | undefined>;

  /** The member's payments, newest first. */
  ofMember(ctx: OperationContext, scope: TenantScope, memberId: Snowflake): Promise<readonly SalaryPayment[]>;
}
