import { Injectable } from '@nestjs/common';
import { type RequestContext, TransactionalConnection } from '@vendure/core';
import type { EntityManager } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
  type AccountToken,
  type AccountTokenPurpose,
  type NewAccountToken,
  OTP_PURPOSE,
  type OtpAttemptWindow,
} from '../domain/account-token';
import type { AccountTokenRepositoryPort } from '../domain/ports/account-token-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { AccountTokenEntity } from './account-token.entity';

/** Postgres answers an UPDATE through `query` with the returned rows and the affected count. */
type UpdateReturningResult = readonly [readonly AccountToken[], number];

const CONSUME_BY_HASH_SQL = `
  UPDATE "account_token" SET "consumedAt" = $1
  WHERE "tokenHash" = $2 AND "purpose" = $3 AND "consumedAt" IS NULL AND "expiresAt" > $1
  RETURNING *`;

/** The conditions of a code that can still be guessed against; `$1` is now, `$2` the user, `$3` the purpose, `$4` the issue cut-off. */
const OPEN_OTP_CONDITION = `
  "userId" = $2 AND "purpose" = $3 AND "otpHash" IS NOT NULL AND "consumedAt" IS NULL
  AND "expiresAt" > $1 AND "createdAt" > $4`;

/**
 * Counter and lock in one statement. Under READ COMMITTED a concurrent UPDATE waits for the row and then re-checks
 * `"otpAttempts" < $5` on the committed version, so the counter can never pass the limit.
 */
const CLAIM_OTP_ATTEMPT_SQL = `
  UPDATE "account_token"
  SET "otpAttempts" = "otpAttempts" + 1,
      "otpLockedAt" = CASE WHEN "otpAttempts" + 1 >= $5 THEN $1::timestamptz ELSE "otpLockedAt" END
  WHERE ${OPEN_OTP_CONDITION} AND "otpAttempts" < $5
  RETURNING *`;

const FIND_OPEN_OTP_SQL = `SELECT * FROM "account_token" WHERE ${OPEN_OTP_CONDITION} LIMIT 1`;

const CONSUME_OTP_TOKEN_SQL = `
  UPDATE "account_token" SET "consumedAt" = $1, "otpLockedAt" = NULL
  WHERE "id" = $2 AND "consumedAt" IS NULL
  RETURNING *`;

const VOID_OPEN_SQL = `
  UPDATE "account_token" SET "consumedAt" = $1
  WHERE "userId" = $2 AND "purpose" = ANY($3::varchar[]) AND "consumedAt" IS NULL`;

/** Held to the end of the transaction, so it is safe behind PgBouncer's transaction pooling (ADR 0016 §6). */
const LOCK_USER_PURPOSE_SQL = `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`;

function requestContextOf(ctx: OperationContext): RequestContext {
  return ctx as unknown as RequestContext;
}

/** {@link AccountTokenRepositoryPort} on Postgres; `account_token` is not a tenant table (D24). */
@Injectable()
export class TypeOrmAccountTokenRepository implements AccountTokenRepositoryPort {
  constructor(private readonly connection: TransactionalConnection) {}

  async replaceOpen(ctx: OperationContext, token: NewAccountToken): Promise<void> {
    await this.connection.withTransaction(requestContextOf(ctx), async (transactional) => {
      const repository = this.connection.getRepository(transactional, AccountTokenEntity);
      if (token.userId !== null) {
        await repository.manager.query(LOCK_USER_PURPOSE_SQL, [
          `account-token:${String(token.userId)}:${token.purpose}`,
        ]);
        await repository.manager.query(VOID_OPEN_SQL, [token.createdAt, token.userId, [token.purpose]]);
      }
      await repository.manager.insert(AccountTokenEntity, token as QueryDeepPartialEntity<AccountTokenEntity>);
    });
  }

  consumeByHash(
    ctx: OperationContext,
    purpose: AccountTokenPurpose,
    tokenHash: string,
    now: Date,
  ): Promise<AccountToken | undefined> {
    return this.firstReturned(this.managerOf(ctx), CONSUME_BY_HASH_SQL, [now, tokenHash, purpose]);
  }

  claimOtpAttempt(userId: number, window: OtpAttemptWindow): Promise<AccountToken | undefined> {
    const parameters = [window.now, userId, OTP_PURPOSE, window.issuedAfter, window.maxAttempts];
    return this.firstReturned(this.connection.rawConnection.manager, CLAIM_OTP_ATTEMPT_SQL, parameters);
  }

  async findOpenOtp(userId: number, window: OtpAttemptWindow): Promise<AccountToken | undefined> {
    const parameters = [window.now, userId, OTP_PURPOSE, window.issuedAfter];
    const rows = await this.connection.rawConnection.manager.query<AccountToken[]>(FIND_OPEN_OTP_SQL, parameters);
    return rows[0];
  }

  consumeOtpToken(ctx: OperationContext, id: string, now: Date): Promise<AccountToken | undefined> {
    return this.firstReturned(this.managerOf(ctx), CONSUME_OTP_TOKEN_SQL, [now, id]);
  }

  async voidOpen(
    ctx: OperationContext,
    userId: number,
    purposes: readonly AccountTokenPurpose[],
    now: Date,
  ): Promise<void> {
    await this.managerOf(ctx).query(VOID_OPEN_SQL, [now, userId, [...purposes]]);
  }

  async lastIssuedAt(ctx: OperationContext, userId: number, purpose: AccountTokenPurpose): Promise<Date | undefined> {
    const latest = await this.connection
      .getRepository(requestContextOf(ctx), AccountTokenEntity)
      .findOne({ where: { userId, purpose }, order: { createdAt: 'DESC' }, select: { createdAt: true } });
    return latest?.createdAt;
  }

  private managerOf(ctx: OperationContext): EntityManager {
    return this.connection.getRepository(requestContextOf(ctx), AccountTokenEntity).manager;
  }

  private async firstReturned(
    manager: EntityManager,
    sql: string,
    parameters: readonly unknown[],
  ): Promise<AccountToken | undefined> {
    const [rows] = await manager.query<UpdateReturningResult>(sql, [...parameters]);
    return rows[0];
  }
}
