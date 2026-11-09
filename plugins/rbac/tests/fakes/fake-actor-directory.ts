import type { OperationContext } from '../../domain/ports/operation-context';
import type { ActorDirectoryPort } from '../../domain/ports/actor-directory.port';

/** Names from a fixed map. */
export class FakeActorDirectory implements ActorDirectoryPort {
  constructor(private readonly names: ReadonlyMap<number, string>) {}

  namesOf(_ctx: OperationContext, ids: readonly number[]): Promise<ReadonlyMap<number, string>> {
    return Promise.resolve(
      new Map(ids.flatMap((id) => (this.names.has(id) ? [[id, this.names.get(id) ?? ''] as const] : []))),
    );
  }
}
