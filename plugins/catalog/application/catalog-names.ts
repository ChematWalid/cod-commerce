import { type DomainError, isSnowflake, type Snowflake } from '@cod/shared';
import { NameTakenError } from '../domain/errors';
import type { CatalogNameRepositoryPort } from '../domain/ports/catalog-name-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { CatalogNameEntry, NewCatalogName } from '../domain/taxonomy';
import type { ProductPorts } from './catalog-ports';

/** The error class a missing entry of one kind answers with. */
export type NotFoundError = new () => DomainError;

/**
 * Parses a brand, tag or highlight id from the API; a malformed one answers not found, like a foreign one (D2136).
 *
 * @throws the given `notFound` error when `rawId` is not a snowflake.
 */
export function snowflakeIdOf(rawId: string, notFound: NotFoundError): Snowflake {
  if (!isSnowflake(rawId)) throw new notFound();
  return rawId;
}

/** How one kind of name (brand or tag) is made, renamed and refused. */
export interface CatalogNameRules {
  readonly create: (input: NewCatalogName) => CatalogNameEntry;
  readonly rename: (entry: CatalogNameEntry, name: string, now: Date) => CatalogNameEntry;
  readonly notFound: NotFoundError;
}

type NamePorts = Pick<ProductPorts, 'transaction' | 'ids' | 'clock'>;

/**
 * The use cases brands and tags share (D2140): a name unique in its store whatever its case or Unicode form, and
 * every lookup by business and store, so an id of another store or business answers not found. Writes run in one
 * transaction each; the unique index decides a race the name check lost.
 */
export class CatalogNames {
  constructor(
    private readonly ports: NamePorts,
    private readonly repository: CatalogNameRepositoryPort,
    private readonly rules: CatalogNameRules,
  ) {}

  /** Every entry of the store, newest first. */
  list(ctx: OperationContext, scope: StoreScope): Promise<readonly CatalogNameEntry[]> {
    return this.repository.list(ctx, scope);
  }

  /** @throws {NameTakenError} when another entry of the store has that name. */
  async create(ctx: OperationContext, scope: StoreScope, name: string): Promise<CatalogNameEntry> {
    const entry = this.rules.create({ id: this.ports.ids.next(), scope, name, now: this.ports.clock.now() });
    return await this.ports.transaction.run(ctx, scope, async (tx) => {
      await this.assertFree(tx, scope, entry);
      await this.repository.insert(tx, scope, entry);
      return entry;
    });
  }

  /** @throws {NameTakenError} when another entry of the store has the new name; not found for none. */
  async update(ctx: OperationContext, scope: StoreScope, rawId: string, name: string): Promise<CatalogNameEntry> {
    const id = snowflakeIdOf(rawId, this.rules.notFound);
    return await this.ports.transaction.run(ctx, scope, async (tx) => {
      const renamed = this.rules.rename(await this.found(tx, scope, id), name, this.ports.clock.now());
      await this.assertFree(tx, scope, renamed);
      if (!(await this.repository.update(tx, scope, renamed))) throw new this.rules.notFound();
      return renamed;
    });
  }

  /**
   * Deletes the entry `rawId` of the store after `beforeDelete` ran in the same transaction (a brand clears its
   * products first, D2140); a tag's links go with it.
   */
  async delete(
    ctx: OperationContext,
    scope: StoreScope,
    rawId: string,
    beforeDelete: (tx: OperationContext, id: Snowflake) => Promise<void> = () => Promise.resolve(),
  ): Promise<void> {
    const id = snowflakeIdOf(rawId, this.rules.notFound);
    await this.ports.transaction.run(ctx, scope, async (tx) => {
      await this.found(tx, scope, id);
      await beforeDelete(tx, id);
      if (!(await this.repository.delete(tx, scope, id))) throw new this.rules.notFound();
    });
  }

  private async found(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<CatalogNameEntry> {
    const entry = await this.repository.findById(ctx, scope, id);
    if (entry === undefined) throw new this.rules.notFound();
    return entry;
  }

  private async assertFree(ctx: OperationContext, scope: StoreScope, entry: CatalogNameEntry): Promise<void> {
    const holder = await this.repository.findByNameKey(ctx, scope, entry.nameKey);
    if (holder !== undefined && holder.id !== entry.id) throw new NameTakenError();
  }
}
