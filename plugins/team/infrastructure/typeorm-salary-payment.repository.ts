import { type TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { type Snowflake, type TenantScope, toBusinessId, toSnowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { OperationContext } from '../domain/ports/operation-context';
import type { SalaryPaymentRepositoryPort } from '../domain/ports/salary-payment-repository.port';
import type { SalaryPayment } from '../domain/salary-payment';
import { requestScope } from './request-scope';
import { SalaryPaymentEntity } from './salary-payment.entity';

function toPayment(row: SalaryPaymentEntity): SalaryPayment {
  return {
    id: toSnowflake(row.id),
    businessId: toBusinessId(row.businessId),
    memberId: toSnowflake(row.memberId),
    amount: row.amount,
    idempotencyKey: row.idempotencyKey,
    paidByAdministratorId: row.paidByAdministratorId,
    paidAt: row.paidAt,
  };
}

/** The Postgres adapter of {@link SalaryPaymentRepositoryPort}, on `TenantRepository` (ADR 0002). */
@Injectable()
export class TypeOrmSalaryPaymentRepository implements SalaryPaymentRepositoryPort {
  private readonly rows: TenantRepository<SalaryPaymentEntity>;

  constructor(repositories: TenantRepositoryFactory) {
    this.rows = repositories.for(SalaryPaymentEntity);
  }

  async insert(ctx: OperationContext, scope: TenantScope, payment: SalaryPayment): Promise<void> {
    await this.rows.insert(requestScope(ctx, scope), payment);
  }

  async findByIdempotencyKey(
    ctx: OperationContext,
    scope: TenantScope,
    memberId: Snowflake,
    idempotencyKey: string,
  ): Promise<SalaryPayment | undefined> {
    const row = await this.rows.findOne(requestScope(ctx, scope), { memberId, idempotencyKey });
    return row === null ? undefined : toPayment(row);
  }

  async ofMember(ctx: OperationContext, scope: TenantScope, memberId: Snowflake): Promise<readonly SalaryPayment[]> {
    const rows = await this.rows.find(requestScope(ctx, scope), {
      where: { memberId },
      order: { paidAt: 'DESC', id: 'DESC' },
    });
    return rows.map(toPayment);
  }
}
