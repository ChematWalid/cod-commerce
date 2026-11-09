import type { OperationContext } from '../domain/ports/operation-context';
import type { TenantScope } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { Administrator, type RequestContext, TransactionalConnection } from '@vendure/core';
import { type FindOptionsWhere, In, type Repository } from 'typeorm';
import type { ActorDirectoryPort } from '../domain/ports/actor-directory.port';
import { toRequestContext } from './request-context';

/** `customFields.businessId` is declared by tenancy, so the generated `where` type cannot know it. */
const ofBusiness = (scope: TenantScope): FindOptionsWhere<Administrator> => ({
  customFields: { businessId: scope.businessId },
});

/**
 * Reads administrators of the caller's business. `administrator` is Vendure's account-level table, not a tenant
 * one, so this file is on the lint allow-list for direct repository access. Every read carries the business.
 */
@Injectable()
export class VendureActorDirectory implements ActorDirectoryPort {
  constructor(private readonly connection: TransactionalConnection) {}

  async namesOf(
    ctx: OperationContext,
    scope: TenantScope,
    ids: readonly number[],
  ): Promise<ReadonlyMap<number, string>> {
    const administrators = await this.repository(toRequestContext(ctx)).find({
      where: { ...ofBusiness(scope), id: In([...ids]) },
      select: { id: true, firstName: true, lastName: true },
      withDeleted: true,
    });
    return new Map(
      administrators.map((administrator) => [
        Number(administrator.id),
        `${administrator.firstName} ${administrator.lastName}`.trim(),
      ]),
    );
  }

  isMember(ctx: OperationContext, scope: TenantScope, administratorId: number): Promise<boolean> {
    return this.repository(toRequestContext(ctx)).existsBy({ ...ofBusiness(scope), id: administratorId });
  }

  private repository(ctx: RequestContext): Repository<Administrator> {
    return this.connection.getRepository(ctx, Administrator);
  }
}
