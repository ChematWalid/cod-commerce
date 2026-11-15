import { asOperationContext } from '../../domain/ports/operation-context';
import { describeCollectionDefinitionRepositoryContract } from '../contract/collection-definition-repository.contract';
import { describeCollectionMemberRepositoryContract } from '../contract/collection-member-repository.contract';
import type { MakeHarness } from '../contract/repository-harness';
import { InMemoryCollectionTables } from '../fakes/in-memory-collection-tables';

/** A fresh pair of in-memory repositories over empty tables for each contract case. */
const inMemory: MakeHarness = () => {
  const tables = new InMemoryCollectionTables();
  return Promise.resolve({
    repos: { definitions: tables.definitions, members: tables.members },
    ctx: asOperationContext({}),
    memberRowIds: (scope, collectionId) => Promise.resolve(tables.memberRowIds(scope, collectionId)),
  });
};

describeCollectionDefinitionRepositoryContract('InMemoryCollectionDefinitionRepository', inMemory);
describeCollectionMemberRepositoryContract('InMemoryCollectionMemberRepository', inMemory);
