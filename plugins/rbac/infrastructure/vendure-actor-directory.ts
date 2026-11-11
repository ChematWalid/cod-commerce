import type { OperationContext } from '../domain/ports/operation-context';
import type { TenantScope } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { Administrator, type RequestContext, TransactionalConnection } from '@vendure/core';
import { type FindOptionsWhere, In, IsNull, type Repository } from 'typeorm';
import type { ActorDirectoryPort } from '../domain/ports/actor-directory.port';
import { toRequestContext } from './request-context';

/** `customFields.businessId` is declared by tenancy, so the generated `where` type cannot know it. */
const ofBusiness = (scope: TenantScope): FindOptionsWhere<Administrator> => ({
  customFields: { businessId: scope.businessId },
});

/** Vendure soft-deletes an administrator by stamping `deletedAt`, a plain column TypeORM does not filter by itself. */
const liveOfBusiness = (scope: TenantScope): FindOptionsWhere<Administrator> => ({
  ...ofBusiness(scope),
  deletedAt: IsNull(),
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
    return this.repository(toRequestContext(ctx)).existsBy({ ...liveOfBusiness(scope), id: administratorId });
  }

  async liveAdministratorIds(
    ctx: OperationContext,
    scope: TenantScope,
    ids: readonly number[],
  ): Promise<readonly number[]> {
    if (ids.length === 0) return [];
    const administrators = await this.repository(toRequestContext(ctx)).find({
      where: { ...liveOfBusiness(scope), id: In([...ids]) },
      select: { id: true },
    });
    return administrators.map((administrator) => Number(administrator.id));
  }

  private repository(ctx: RequestContext): Repository<Administrator> {
    return this.connection.getRepository(ctx, Administrator);
  }
}
