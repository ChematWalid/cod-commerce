import { requirePermission } from '@cod/plugin-rbac/guard';
import { RequestTenantScope, tenantOf } from '@cod/plugin-tenancy';
import type { TenantScope } from '@cod/shared';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import { type TenantSecretView, TenantSecretService } from '../application/tenant-secret.service';
import { SecretNotFoundError } from '../domain/errors';
import { mapDomainError } from './error-mapping';

/** A secret as the Admin API returns it (`TenantSecret`): `updatedAt` is a `DateTime`. */
export interface TenantSecretDto extends Omit<TenantSecretView, 'updatedAt'> {
  readonly updatedAt: Date;
}

interface SetTenantSecretArgs {
  readonly input: { readonly provider: string; readonly ref: string; readonly value: string };
}

interface DeleteTenantSecretArgs {
  readonly id: string;
}

const toDto = (view: TenantSecretView): TenantSecretDto => ({ ...view, updatedAt: new Date(view.updatedAt) });

/**
 * The Admin API of the tenant secrets. Listing needs `apps.view`, writing and deleting `apps.manage`; each handler
 * runs in the caller's tenant scope. The mutations open no transaction: the store's own statements are single writes,
 * and a unique violation inside a transaction would abort it.
 */
@Resolver()
export class TenantSecretsResolver {
  constructor(private readonly secrets: TenantSecretService) {}

  @Query()
  @requirePermission('apps.view')
  tenantSecrets(@Ctx() ctx: RequestContext): Promise<TenantSecretDto[]> {
    return this.inScope(ctx, async (scope) => (await this.secrets.list(scope)).map(toDto));
  }

  @Mutation()
  @requirePermission('apps.manage')
  setTenantSecret(@Ctx() ctx: RequestContext, @Args() args: SetTenantSecretArgs): Promise<TenantSecretDto> {
    return this.inScope(ctx, async (scope) => toDto(await this.secrets.put(scope, args.input)));
  }

  @Mutation()
  @requirePermission('apps.manage')
  deleteTenantSecret(@Ctx() ctx: RequestContext, @Args() args: DeleteTenantSecretArgs): Promise<boolean> {
    return this.inScope(ctx, async (scope) => {
      if (!(await this.secrets.delete(scope, args.id))) {
        throw new SecretNotFoundError();
      }
      return true;
    });
  }

  /** Builds the caller's scope and runs `work` in it; a domain error leaves through the one error mapping. */
  private async inScope<T>(ctx: RequestContext, work: (scope: TenantScope) => Promise<T>): Promise<T> {
    try {
      return await work(new RequestTenantScope(ctx, tenantOf(ctx).businessId));
    } catch (error) {
      mapDomainError(error);
    }
  }
}
