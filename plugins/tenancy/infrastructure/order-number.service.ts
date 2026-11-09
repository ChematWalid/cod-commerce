import { type BusinessId, formatOrderNumber } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { type RequestContext, TransactionalConnection } from '@vendure/core';
import { BusinessNotFoundError, TransactionRequiredError } from '../domain/errors';
import { BusinessOrderSequenceEntity } from './business-order-sequence.entity';

/** Postgres answers an UPDATE through `query` with the returned rows and the affected count. */
type UpdateReturningResult = readonly [ReadonlyArray<{ readonly last: string }>, number];

/** The row lock the UPDATE takes serializes a business's orders and is released with the transaction, so a rollback leaves no gap. */
const NEXT_NUMBER_SQL =
  'UPDATE "business_order_sequence" SET "last" = "last" + 1 WHERE "businessId" = $1 RETURNING "last"';

/** Issues a business's next order number. Not a TenantRepository: the sequence is keyed by the business itself. */
@Injectable()
export class OrderNumberService {
  constructor(private readonly connection: TransactionalConnection) {}

  /**
   * The next display number (`#00000001`) of the business, taken on `ctx`'s transaction so it is committed or
   * rolled back with the order it numbers.
   *
   * @throws TransactionRequiredError when `ctx` carries no active transaction.
   * @throws BusinessNotFoundError when the business has no sequence.
   */
  async nextOrderNumber(ctx: RequestContext, businessId: BusinessId): Promise<string> {
    const manager = this.connection.getRepository(ctx, BusinessOrderSequenceEntity).manager;
    if (!manager.queryRunner?.isTransactionActive) throw new TransactionRequiredError();
    const [rows]: UpdateReturningResult = await manager.query(NEXT_NUMBER_SQL, [businessId]);
    const row = rows[0];
    if (!row) throw new BusinessNotFoundError();
    return formatOrderNumber(BigInt(row.last));
  }
}
