import { type BusinessId, IDEMPOTENCY_KEY_MAX_LENGTH, type Snowflake, type TenantScope } from '@cod/shared';
import { InvalidInputError } from './errors';
import type { TeamMember } from './team-member';

/** One salary payment of a member, booked once per client idempotency key (D212). */
export interface SalaryPayment {
  readonly id: Snowflake;
  readonly businessId: BusinessId;
  readonly memberId: Snowflake;
  /** Whole DZD (ADR 0004), read from the member's base salary when paid. */
  readonly amount: number;
  readonly idempotencyKey: string;
  readonly paidByAdministratorId: number;
  readonly paidAt: Date;
}

/** What {@link createSalaryPayment} needs. */
export interface NewSalaryPaymentInput {
  readonly id: Snowflake;
  readonly scope: TenantScope;
  readonly member: Pick<TeamMember, 'id' | 'baseSalary'>;
  readonly idempotencyKey: string;
  readonly paidByAdministratorId: number;
  readonly now: Date;
}

/**
 * A payment of the member's current base salary.
 *
 * @throws {InvalidInputError} when the idempotency key is empty or longer than {@link IDEMPOTENCY_KEY_MAX_LENGTH}.
 */
export function createSalaryPayment(input: NewSalaryPaymentInput): SalaryPayment {
  const { idempotencyKey } = input;
  if (idempotencyKey.length === 0 || idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new InvalidInputError();
  }
  return {
    id: input.id,
    businessId: input.scope.businessId,
    memberId: input.member.id,
    amount: input.member.baseSalary,
    idempotencyKey,
    paidByAdministratorId: input.paidByAdministratorId,
    paidAt: input.now,
  };
}

/** A payment as the API answers it: no business id, nothing of the member beyond its id. */
export interface SalaryPaymentView {
  readonly id: Snowflake;
  readonly memberId: Snowflake;
  /** Whole DZD (ADR 0004). */
  readonly amount: number;
  readonly idempotencyKey: string;
  readonly paidByAdministratorId: number;
  readonly paidAt: Date;
}

/** Copies the fields a client may see, field by field. */
export function toSalaryPaymentView(payment: SalaryPayment): SalaryPaymentView {
  return {
    id: payment.id,
    memberId: payment.memberId,
    amount: payment.amount,
    idempotencyKey: payment.idempotencyKey,
    paidByAdministratorId: payment.paidByAdministratorId,
    paidAt: payment.paidAt,
  };
}
