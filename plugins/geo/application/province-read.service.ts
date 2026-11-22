import { parseWilayaCodeParam, type Province, type StoreId, type Town, type WilayaCode } from '@cod/shared';
import { GeoStoreNotFoundError, ProvinceNotFoundError } from '../domain/errors';
import { GeoCatalog, narrowTown } from '../domain/geo-catalog';
import type { AvailabilityCache } from '../domain/ports/availability-cache.port';
import type { GeoReferenceReader } from '../domain/ports/geo-reference-reader.port';
import type { ServedStores } from '../domain/ports/served-stores.port';
import type { TownAvailability, TownAvailabilitySource } from '../domain/ports/town-availability.port';
import type { TownDirectory } from '../domain/ports/town-directory.port';
import type { SourceHolder } from './single-source.registry';

/** What {@link ProvinceReadService} reads through. */
export interface ProvinceReadDependencies {
  readonly reader: GeoReferenceReader;
  readonly stores: ServedStores;
  readonly availability: SourceHolder<TownAvailabilitySource>;
  readonly cache: AvailabilityCache;
}

/**
 * The wilayas and communes the provinces routes answer: the public reference data (D3117) and, for a served store,
 * the communes narrowed by its delivery fee table (D3106). The tables are read once per process: they change only on
 * `migrate` (D3116). It is also the {@link TownDirectory} delivery pricing validates a commune's wilaya through (D3128).
 */
export class ProvinceReadService implements TownDirectory {
  private catalog: Promise<GeoCatalog> | undefined;

  constructor(private readonly dependencies: ProvinceReadDependencies) {}

  /** Every wilaya, ordered by code, without communes. */
  async list(): Promise<readonly Province[]> {
    return (await this.catalogOnce()).list();
  }

  /**
   * The wilaya of a code parameter (`16`, `1` or `01`) with its communes.
   * @throws {ProvinceNotFoundError} for any other parameter, or a wilaya not seeded.
   */
  async byCode(rawCode: string): Promise<Province> {
    const code = parseWilayaCodeParam(rawCode);
    const province = code === null ? undefined : (await this.catalogOnce()).withTowns(code);
    if (province === undefined) throw new ProvinceNotFoundError();
    return province;
  }

  /**
   * The wilayas, for a served store: the same list as {@link list}, which carries no delivery flag.
   * @throws {GeoStoreNotFoundError} unless `rawStoreId` is a served store.
   */
  async listForStore(rawStoreId: unknown): Promise<readonly Province[]> {
    await this.servedStore(rawStoreId);
    return this.list();
  }

  /**
   * The wilaya with its communes as the store offers them: each flag ANDed with the registered availability source.
   * @throws {GeoStoreNotFoundError} unless `rawStoreId` is a served store, checked before the code.
   * @throws {ProvinceNotFoundError} for a code parameter that names no wilaya.
   */
  async byCodeForStore(rawStoreId: unknown, rawCode: string): Promise<Province> {
    const storeId = await this.servedStore(rawStoreId);
    const province = await this.byCode(rawCode);
    const availability = await this.availabilityOf(storeId, province);
    if (availability === null) return province;
    return { ...province, towns: province.towns?.map((town) => narrowTown(town, availability)) };
  }

  /** The ONS codes of the wilaya's communes, ascending; none for a wilaya the reference data does not hold. */
  async townsOf(provinceCode: WilayaCode): Promise<readonly number[]> {
    const province = (await this.catalogOnce()).withTowns(provinceCode);
    return province?.towns?.map((town) => town.codeOns) ?? [];
  }

  /** The wilaya's commune `codeOns`, or `undefined` when it is unknown or of another wilaya. */
  async townOf(provinceCode: WilayaCode, codeOns: number): Promise<Town | undefined> {
    const province = (await this.catalogOnce()).withTowns(provinceCode);
    return province?.towns?.find((town) => town.codeOns === codeOns);
  }

  private async servedStore(raw: unknown): Promise<StoreId> {
    const storeId = await this.dependencies.stores.servedStore(raw);
    if (storeId === null) throw new GeoStoreNotFoundError();
    return storeId;
  }

  private async availabilityOf(storeId: StoreId, { code }: Province): Promise<TownAvailability | null> {
    const { cache, availability } = this.dependencies;
    const key = `${storeId}:${code}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const fresh = await availability.current().availabilityFor(storeId, code);
    cache.set(key, fresh);
    return fresh;
  }

  /** The catalog, read on first use; a failed read is forgotten so the next call retries. */
  private catalogOnce(): Promise<GeoCatalog> {
    this.catalog ??= this.dependencies.reader.read().then(
      (reference) => new GeoCatalog(reference),
      (error: unknown) => {
        this.catalog = undefined;
        throw error;
      },
    );
    return this.catalog;
  }
}
