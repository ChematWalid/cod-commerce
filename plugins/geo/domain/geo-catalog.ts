import type { Province, Town, WilayaCode } from '@cod/shared';
import type { GeoSeed, ProvinceSeed, TownSeed } from './geo-seed';
import type { TownAvailability } from './ports/town-availability.port';

/** A commune in the API shape: its `id` is its stringified ONS code. */
const toTown = (seed: TownSeed): Town => ({ id: String(seed.codeOns), ...seed });

/** A wilaya in the API shape, without its communes: its `id` is its two-digit code. */
const toProvince = (seed: ProvinceSeed): Province => ({ id: seed.code, ...seed });

const byCode = (left: ProvinceSeed, right: ProvinceSeed): number => left.code.localeCompare(right.code);
const byOns = (left: TownSeed, right: TownSeed): number => left.codeOns - right.codeOns;

/**
 * The geo reference data indexed for reading: the wilayas by code, and each wilaya with its communes by ONS code.
 * Built once per process from the tables, which change only on `migrate` (D3116).
 */
export class GeoCatalog {
  private readonly provinces: readonly Province[];
  private readonly detailed: ReadonlyMap<WilayaCode, Province>;

  constructor(reference: GeoSeed) {
    const sorted = [...reference.provinces].sort(byCode);
    const towns = [...reference.towns].sort(byOns);
    this.provinces = sorted.map(toProvince);
    this.detailed = new Map(
      sorted.map((province) => [
        province.code,
        { ...toProvince(province), towns: towns.filter((town) => town.provinceCode === province.code).map(toTown) },
      ]),
    );
  }

  /** Every wilaya, ordered by code, without communes. */
  list(): readonly Province[] {
    return this.provinces;
  }

  /** The wilaya with its communes, or `undefined` when the reference data does not hold it. */
  withTowns(code: WilayaCode): Province | undefined {
    return this.detailed.get(code);
  }
}

/**
 * A commune's flags as a store offers them: the reference flags ANDed with the store's modes, the commune's own when
 * it differs from its wilaya (D3125), so a store never offers what the reference data does not. `null` narrows
 * nothing.
 */
export function narrowTown(town: Town, availability: TownAvailability | null): Town {
  if (availability === null) return town;
  const modes = availability.towns.get(town.codeOns) ?? availability;
  return { ...town, isHomeDelivery: town.isHomeDelivery && modes.home, isStopdesk: town.isStopdesk && modes.desk };
}
