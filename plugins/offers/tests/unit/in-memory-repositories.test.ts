import { asOperationContext } from '../../domain/ports/operation-context.port';
import { describeOfferCodeRepositoryContract } from '../contract/offer-code-repository.contract';
import { describeOfferRepositoryContract, type MakeOfferHarness } from '../contract/offer-repository.contract';
import { InMemoryOfferTables } from '../fakes/in-memory-offer-repository';
import { withRoundTrips } from '../fakes/round-trip';

const harness: MakeOfferHarness = () => {
  const tables = new InMemoryOfferTables();
  return Promise.resolve({
    offers: withRoundTrips(tables.offers),
    codes: withRoundTrips(tables.codes),
    ctx: asOperationContext({}),
  });
};

// The fakes the use-case tests run on must keep the same rules as the Postgres adapters (Task 10); they answer a
// turn later, as Postgres does, so a rejection a test handles late fails here too.
describeOfferRepositoryContract('InMemoryOfferRepository', harness);
describeOfferCodeRepositoryContract('InMemoryOfferCodeRepository', harness);
