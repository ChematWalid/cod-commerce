import type { OfferDefinition, OfferTarget } from '@cod/shared';

/**
 * An offer as the engine reads it: the shared {@link OfferDefinition}, read-only, with instants already parsed to
 * UTC dates (D2419) and `config` still `unknown` until the kind registry parses it (D2404).
 */
export type Offer = Readonly<Omit<OfferDefinition, 'targets'>> & {
  readonly targets: readonly Readonly<OfferTarget>[];
};
