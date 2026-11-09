import { Injectable } from '@nestjs/common';
import { ExternalAuthenticationMethod, type RequestContext, TransactionalConnection, User } from '@vendure/core';
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

  async findUserId(ctx: OperationContext, provider: OAuthProviderName, subject: string): Promise<number | undefined> {
    const method = await this.connection.getRepository(requestContextOf(ctx), ExternalAuthenticationMethod).findOne({
      where: { strategy: provider, externalIdentifier: subject },
      relations: { user: true },
    });
    return method === null || method.user.deletedAt !== null ? undefined : accountUserId(method.user.id);
  }

  async link(ctx: OperationContext, userId: number, provider: OAuthProviderName, subject: string): Promise<void> {
    const user = await this.connection.getRepository(requestContextOf(ctx), User).findOneByOrFail({ id: userId });
    await this.connection
      .getRepository(requestContextOf(ctx), ExternalAuthenticationMethod)
      .save(new ExternalAuthenticationMethod({ strategy: provider, externalIdentifier: subject, user }));
  }
}
