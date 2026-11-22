import type { TownAvailabilitySource } from '../domain/ports/town-availability.port';
import { SingleSourceRegistry } from './single-source.registry';

/** No store narrows any wilaya until delivery pricing registers its fee tables. */
const NO_NARROWING: TownAvailabilitySource = { availabilityFor: () => Promise.resolve(null) };

/** The town availability seam, narrowing nothing until delivery pricing registers. */
export const newTownAvailabilityRegistry = (): SingleSourceRegistry<TownAvailabilitySource> =>
  new SingleSourceRegistry('town availability source', NO_NARROWING);
