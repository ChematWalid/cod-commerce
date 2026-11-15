import type { CollectionDefinitionRepositoryPort } from '../domain/ports/collection-definition-repository.port';
import type { CollectionEventsPort } from '../domain/ports/collection-events.port';
import type { CollectionMemberRepositoryPort } from '../domain/ports/collection-member-repository.port';
import type { DescriptionSanitizerPort } from '../domain/ports/description-sanitizer.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { StoreLockPort } from '../domain/ports/store-lock.port';
import type { TransactionPort } from '../domain/ports/transaction.port';
import type { VendureCollectionsPort } from '../domain/ports/vendure-collections.port';

/** The ports the collection use cases share; wired in `infrastructure/collections.providers.ts`. */
export interface CollectionPorts {
  readonly transaction: TransactionPort;
  readonly lock: StoreLockPort;
  readonly definitions: CollectionDefinitionRepositoryPort;
  readonly members: CollectionMemberRepositoryPort;
  readonly vendure: VendureCollectionsPort;
  readonly events: CollectionEventsPort;
  readonly ids: IdGeneratorPort;
  readonly sanitizer: DescriptionSanitizerPort;
}
