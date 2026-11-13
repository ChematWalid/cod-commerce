import { asOperationContext } from '../../domain/ports/operation-context';
import { describeCommissionConfigRepositoryContract } from '../contract/commission-config-repository.contract';
import { InMemoryCommissionConfigRepository } from '../fakes/in-memory-commission-config-repository';

// The fake the commission tests run on must keep the same rules as the Postgres adapter.
describeCommissionConfigRepositoryContract('InMemoryCommissionConfigRepository', () =>
  Promise.resolve({ repo: new InMemoryCommissionConfigRepository(), ctx: asOperationContext({}) }),
);
