import { Injectable } from '@nestjs/common';
import {
  ConfigService,
  type RequestContext,
  RequestContextService,
  TransactionalConnection,
  User,
} from '@vendure/core';
import type { OperationContext } from '../domain/ports/operation-context';
import { toRequestContext } from './operation-context.adapter';
import { shareTransaction } from './share-transaction';

/**
 * Role and administrator creation check the active user, but an owner adding a store and an anonymous sign-up are
 * legitimate callers, so platform code that must act for them runs as the superadmin (A2).
 */
@Injectable()
export class SuperadminContextFactory {
  constructor(
    private readonly config: ConfigService,
    private readonly connection: TransactionalConnection,
    private readonly requestContexts: RequestContextService,
  ) {}

  /**
   * A superadmin context on the caller's transaction. It is built per call: Vendure caches a user's channels per
   * context, and creating a channel adds one to the superadmin's role.
   */
  async create(ctx: OperationContext): Promise<RequestContext> {
    const caller = toRequestContext(ctx);
    const { identifier } = this.config.authOptions.superadminCredentials;
    const user = await this.connection
      .getRepository(caller, User)
      .findOneOrFail({ where: { identifier }, relations: { roles: { channels: true } } });
    const superadmin = await this.requestContexts.create({
      apiType: 'admin',
      channelOrToken: caller.channel,
      user,
    });
    return shareTransaction(caller, superadmin);
  }
}
