import { asOperationContext } from '../../domain/ports/operation-context';
import { describeMemberRepositoryContract } from '../contract/member-repository.contract';
import { InMemoryMemberRepository } from '../fakes/in-memory-member-repository';

// The fake the use-case tests run on must keep the same rules as the Postgres adapter.
describeMemberRepositoryContract('InMemoryMemberRepository', () =>
  Promise.resolve({ repo: new InMemoryMemberRepository(), ctx: asOperationContext({}) }),
);
