import type { OperationContext } from '../../domain/ports/operation-context';
import type { CollectionDefinitionRepositoryPort } from '../../domain/ports/collection-definition-repository.port';
import type { CollectionMemberRepositoryPort } from '../../domain/ports/collection-member-repository.port';
import type { StoreScope } from '../../domain/store-scope';

/** The two repositories of one adapter family over the same tables: members need their definition (FK, D2337). */
export interface CollectionRepositories {
  readonly definitions: CollectionDefinitionRepositoryPort;
  readonly members: CollectionMemberRepositoryPort;
}

/** Repositories over empty tables, the context their calls run in, and a test-only look at stored member rows. */
export interface RepositoryHarness {
  readonly repos: CollectionRepositories;
  readonly ctx: OperationContext;
  /** The stored row id of each member of a collection, keyed by product id, so a test sees which rows were rewritten. */
  memberRowIds(scope: StoreScope, collectionId: string): Promise<ReadonlyMap<string, string>>;
}

/** Builds a fresh harness for one contract case. */
export type MakeHarness = () => Promise<RepositoryHarness>;
