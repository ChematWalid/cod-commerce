import type { TenantScope } from '@cod/shared';
import type { ActorDirectoryPort } from '../../domain/ports/actor-directory.port';
import type { OperationContext } from '../../domain/ports/operation-context';

/** Names from a fixed map; everyone in it is a member. */
export class FakeActorDirectory implements ActorDirectoryPort {
  constructor(private readonly names: ReadonlyMap<number, string>) {}

  namesOf(_ctx: OperationContext, _scope: TenantScope, ids: readonly number[]): Promise<ReadonlyMap<number, string>> {
    return Promise.resolve(
      new Map(ids.flatMap((id) => (this.names.has(id) ? [[id, this.names.get(id) ?? ''] as const] : []))),
    );
  }

  isMember(_ctx: OperationContext, _scope: TenantScope, administratorId: number): Promise<boolean> {
    return Promise.resolve(this.names.has(administratorId));
  }

  liveAdministratorIds(
    _ctx: OperationContext,
    _scope: TenantScope,
    ids: readonly number[],
  ): Promise<readonly number[]> {
    return Promise.resolve(ids.filter((id) => this.names.has(id)));
  }
}
