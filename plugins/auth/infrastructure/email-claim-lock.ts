import { Injectable } from '@nestjs/common';
import { Administrator, type RequestContext, TransactionalConnection } from '@vendure/core';
import type { EmailClaimPort } from '../domain/ports/account-identity.port';
import type { OperationContext } from '../domain/ports/operation-context';

const CLAIM_EMAIL_SQL = `SELECT pg_advisory_xact_lock(hashtextextended('account-email:' || $1, 0))`;

/**
 * A transaction-scoped advisory lock on the email (D41): nothing in the schema makes an identifier unique. It ends
 * with the transaction, so it is safe behind PgBouncer's transaction pooling (ADR 0016 §6).
 */
@Injectable()
export class EmailClaimLock implements EmailClaimPort {
  constructor(private readonly connection: TransactionalConnection) {}

  async claim(ctx: OperationContext, email: string): Promise<void> {
    const repository = this.connection.getRepository(ctx as unknown as RequestContext, Administrator);
    await repository.manager.query(CLAIM_EMAIL_SQL, [email]);
  }
}
