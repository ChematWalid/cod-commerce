import { Injectable } from '@nestjs/common';
import { Administrator, type RequestContext, TransactionalConnection } from '@vendure/core';
import { IsNull, type Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import type { AuthEmailLocale } from '../domain/email';
import type { AccountIdentityPort } from '../domain/ports/account-identity.port';
import type { OperationContext } from '../domain/ports/operation-context';

const requestContextOf = (ctx: OperationContext): RequestContext => ctx as unknown as RequestContext;

/** {@link AccountIdentityPort} over Vendure's administrators, which are account-level and not tenant tables. */
@Injectable()
export class VendureAccountIdentity implements AccountIdentityPort {
  constructor(private readonly connection: TransactionalConnection) {}

  inTransaction<T>(ctx: OperationContext, work: (transactional: OperationContext) => Promise<T>): Promise<T> {
    return this.connection.withTransaction(requestContextOf(ctx), (transactional) =>
      work(transactional as unknown as OperationContext),
    );
  }

  isEmailTaken(ctx: OperationContext, email: string): Promise<boolean> {
    return this.administrators(ctx).exists({ where: { emailAddress: email, deletedAt: IsNull() } });
  }

  async setEmailLocale(ctx: OperationContext, administratorId: number, locale: AuthEmailLocale): Promise<void> {
    // Plugin custom fields are unknown to the compiler; `configure` in the plugin module declares this one.
    const change = { customFields: { emailLocale: locale } } as QueryDeepPartialEntity<Administrator>;
    await this.administrators(ctx).update({ id: administratorId }, change);
  }

  async userIdOfAdministrator(ctx: OperationContext, administratorId: number): Promise<number> {
    const administrator = await this.administrators(ctx).findOneOrFail({
      where: { id: administratorId },
      relations: { user: true },
    });
    return administrator.user.id as number;
  }

  private administrators(ctx: OperationContext): Repository<Administrator> {
    return this.connection.getRepository(requestContextOf(ctx), Administrator);
  }
}
