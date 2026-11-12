import { ACTIVITY_ACTIONS, type Snowflake } from '@cod/shared';
import { MemberNotActiveError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import { createSalaryPayment, type SalaryPaymentView, toSalaryPaymentView } from '../domain/salary-payment';
import { assertNotSelf } from '../domain/self-action';
import type { TeamActor } from '../domain/team-actor';
import type { MemberActionPorts } from './member-action-ports';
import { recordAction } from './member-change';
import { administratorOf, lockedMemberInReach } from './member-in-reach';

/**
 * "Pay salary": books one payment of the member's base salary per client key and announces it for the ledger (D212).
 * No finance row is written here; P6.S4 books `SalaryPaid`.
 */
export class PaySalaryService {
  constructor(private readonly ports: MemberActionPorts) {}

  /**
   * Under the business lock and the member's row lock, pays the base salary read now. A key already used for the
   * member answers its first payment and publishes nothing; `SalaryPaid` reaches subscribers only once committed.
   *
   * @throws {InvalidInputError} for an empty or too long idempotency key.
   * @throws {MemberNotFoundError} for no such member or one out of the actor's reach (D211).
   * @throws {SelfActionError} for the actor's own member row.
   * @throws {MemberNotActiveError} for an invited or deactivated member.
   */
  async pay(
    ctx: OperationContext,
    actor: TeamActor,
    id: Snowflake,
    idempotencyKey: string,
  ): Promise<SalaryPaymentView> {
    const payment = await this.ports.transaction.run(ctx, actor.scope, async (transactional) => {
      await this.ports.lock.acquire(transactional, actor.scope);
      return this.payIn(transactional, actor, id, idempotencyKey);
    });
    return toSalaryPaymentView(payment);
  }

  private async payIn(ctx: OperationContext, actor: TeamActor, id: Snowflake, idempotencyKey: string) {
    const { salaries, salaryPaid, ids, clock } = this.ports;
    const { member } = await lockedMemberInReach(this.ports, ctx, actor, id);
    assertNotSelf(actor.administratorId, member);
    const payment = createSalaryPayment({
      id: ids.next(),
      scope: actor.scope,
      member,
      idempotencyKey,
      paidByAdministratorId: actor.administratorId,
      now: clock.now(),
    });
    const booked = await salaries.findByIdempotencyKey(ctx, actor.scope, member.id, idempotencyKey);
    if (booked !== undefined) return booked;
    if (member.status !== 'active') throw new MemberNotActiveError();
    await salaries.insert(ctx, actor.scope, payment);
    await salaryPaid.publish(ctx, actor.scope, payment, administratorOf(member));
    await recordAction(this.ports, ctx, actor, {
      member,
      action: ACTIVITY_ACTIONS.SALARY_PAID,
      summary: 'Salary paid',
      changedFields: [],
    });
    return payment;
  }
}
