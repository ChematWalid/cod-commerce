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
// turn later, as Postgres does, and fail on a refusal that had no handler when its round trip went out (D2443): one
// left pending across another awaited call, or two started together and awaited in turn.
describeOfferRepositoryContract('InMemoryOfferRepository', harness);
describeOfferCodeRepositoryContract('InMemoryOfferCodeRepository', harness);
