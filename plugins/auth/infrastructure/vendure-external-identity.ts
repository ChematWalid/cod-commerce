import { Injectable } from '@nestjs/common';
import { ExternalAuthenticationMethod, type RequestContext, TransactionalConnection, User } from '@vendure/core';
import { IsNull } from 'typeorm';
import { accountUserId } from '../domain/account-user-id';
import type { OAuthProviderName } from '../domain/oauth';
import type { ExternalIdentityPort } from '../domain/ports/external-identity.port';
import type { OperationContext } from '../domain/ports/operation-context';

const requestContextOf = (ctx: OperationContext): RequestContext => ctx as unknown as RequestContext;

/**
 * Vendure's `ExternalAuthenticationMethod`, written directly: `ExternalAuthenticationService` creates a user and
 * administrator of its own, while here the account comes from tenancy's provisioning or already exists.
 */
@Injectable()
export class VendureExternalIdentity implements ExternalIdentityPort {
  constructor(private readonly connection: TransactionalConnection) {}

  /**
   * The live user holding this provider login. A soft delete keeps the deleted user's link, and an unordered lookup
   * would return that oldest row first and hide the link of an account registered again with the same login.
   */
  async findUserId(ctx: OperationContext, provider: OAuthProviderName, subject: string): Promise<number | undefined> {
    const method = await this.connection.getRepository(requestContextOf(ctx), ExternalAuthenticationMethod).findOne({
      where: { strategy: provider, externalIdentifier: subject, user: { deletedAt: IsNull() } },
      relations: { user: true },
    });
    return method === null ? undefined : accountUserId(method.user.id);
  }

  hasAny(ctx: OperationContext, userId: number): Promise<boolean> {
    return this.connection
      .getRepository(requestContextOf(ctx), ExternalAuthenticationMethod)
      .exists({ where: { user: { id: userId } } });
  }

  async link(ctx: OperationContext, userId: number, provider: OAuthProviderName, subject: string): Promise<void> {
    const user = await this.connection.getRepository(requestContextOf(ctx), User).findOneByOrFail({ id: userId });
    await this.connection
      .getRepository(requestContextOf(ctx), ExternalAuthenticationMethod)
      .save(new ExternalAuthenticationMethod({ strategy: provider, externalIdentifier: subject, user }));
  }

  async unlinkAll(ctx: OperationContext, userId: number): Promise<void> {
    await this.connection
      .getRepository(requestContextOf(ctx), ExternalAuthenticationMethod)
      .delete({ user: { id: userId } });
  }
}
