import { asOperationContext } from '../../domain/ports/operation-context.port';
import { describeOfferCodeRepositoryContract } from '../contract/offer-code-repository.contract';
import { describeOfferRepositoryContract, type MakeOfferHarness } from '../contract/offer-repository.contract';
import { InMemoryOfferTables } from '../fakes/in-memory-offer-repository';

const harness: MakeOfferHarness = () => {
  const tables = new InMemoryOfferTables();
  return Promise.resolve({ offers: tables.offers, codes: tables.codes, ctx: asOperationContext({}) });
};

// The fakes the use-case tests run on must keep the same rules as the Postgres adapters (Task 10).
describeOfferRepositoryContract('InMemoryOfferRepository', harness);
describeOfferCodeRepositoryContract('InMemoryOfferCodeRepository', harness);
