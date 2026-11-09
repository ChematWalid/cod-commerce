import type { OperationContext } from '../domain/ports/operation-context';
import { Injectable } from '@nestjs/common';
import { Administrator, TransactionalConnection } from '@vendure/core';
import { In } from 'typeorm';
import type { ActorDirectoryPort } from '../domain/ports/actor-directory.port';
import { toRequestContext } from './request-context';

/**
 * Reads administrators' names. `administrator` is Vendure's account-level table, not a tenant one, so this file
 * is on the lint allow-list for direct repository access. The ids come from a business's own rows, and only
 * names leave.
 */
@Injectable()
export class VendureActorDirectory implements ActorDirectoryPort {
  constructor(private readonly connection: TransactionalConnection) {}

  async namesOf(ctx: OperationContext, ids: readonly number[]): Promise<ReadonlyMap<number, string>> {
    const administrators = await this.connection.getRepository(toRequestContext(ctx), Administrator).find({
      where: { id: In([...ids]) },
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
}
