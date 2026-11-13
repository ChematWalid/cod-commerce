import { asOperationContext } from '../../domain/ports/operation-context';
import { describeInvitationRepositoryContract } from '../contract/invitation-repository.contract';
import { InMemoryInvitationRepository } from '../fakes/in-memory-invitation-repository';

// The fake the use-case tests run on must keep the same rules as the Postgres adapter.
describeInvitationRepositoryContract('InMemoryInvitationRepository', () =>
  Promise.resolve({ repo: new InMemoryInvitationRepository(), ctx: asOperationContext({}) }),
);
