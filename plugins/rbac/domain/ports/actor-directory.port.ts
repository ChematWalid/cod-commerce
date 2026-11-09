import type { OperationContext } from './operation-context';

/** The display names of administrators. */
export interface ActorDirectoryPort {
  /** The name of each administrator that exists; an id with no administrator is absent from the map. */
  namesOf(ctx: OperationContext, ids: readonly number[]): Promise<ReadonlyMap<number, string>>;
}
