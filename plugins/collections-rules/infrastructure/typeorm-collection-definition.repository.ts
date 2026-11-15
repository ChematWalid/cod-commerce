import type { TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { COLLECTION_MODES, type CollectionMode, type CollectionRule, collectionRuleSchema } from '@cod/shared';
import { In } from 'typeorm';
import type { CollectionDefinition } from '../domain/collection';
import { CorruptCollectionDefinitionError } from '../domain/corrupt-collection-definition.error';
import { CollectionRowConflictError } from '../domain/collection-row-conflict.error';
import { canonicalCoreId, canonicalCoreIds, writableCollectionId } from '../domain/core-id';
import type {
  CollectionDefinitionRepositoryPort,
  DefinitionListRequest,
  DefinitionPage,
} from '../domain/ports/collection-definition-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import { CollectionDefinitionEntity } from './collection-definition.entity';
import { onUniqueViolation } from './constraint-violation';
import { requestScope } from './request-scope';

/** The order of every list of definitions (D2318). */
const LIST_ORDER = { position: 'ASC', id: 'ASC' } as const;

const isMode = (value: string): value is CollectionMode => (COLLECTION_MODES as readonly string[]).includes(value);

/**
 * A stored rule read back through the shared schema, so a row edited by hand never reaches the evaluator untyped;
 * `undefined` when the stored value breaks the schema.
 */
function ruleOf(stored: unknown): CollectionRule | null | undefined {
  if (stored === null || stored === undefined) return null;
  const parsed = collectionRuleSchema.safeParse(stored);
  return parsed.success ? parsed.data : undefined;
}

/** @throws {CorruptCollectionDefinitionError} for a row that breaks the stored shape (server-side corruption). */
function toDefinition(row: CollectionDefinitionEntity): CollectionDefinition {
  const rule = ruleOf(row.rule);
  // The CHECK `collections_definition_store_required` keeps `storeId` set; the null test only narrows the type.
  if (!isMode(row.mode) || row.storeId === null || rule === undefined) {
    throw new CorruptCollectionDefinitionError(row.businessId, row.id);
  }
  return {
    id: row.id,
    collectionId: row.collectionId,
    storeId: row.storeId,
    mode: row.mode,
    rule,
    matchVersion: row.matchVersion,
    visible: row.visible,
    position: row.position,
  };
}

/** The columns a save writes; the store always comes from the scope, never from the definition. */
const columnsOf = (definition: CollectionDefinition) => ({
  mode: definition.mode,
  match: definition.rule?.match ?? null,
  rule: definition.rule,
  matchVersion: definition.matchVersion,
  visible: definition.visible,
  position: definition.position,
});

/**
 * The Postgres adapter of {@link CollectionDefinitionRepositoryPort} through `TenantRepository` (ADR 0002). A collection
 * id is made canonical before it reaches Postgres: a malformed one names no definition.
 */
export class TypeOrmCollectionDefinitionRepository implements CollectionDefinitionRepositoryPort {
  private readonly rows: TenantRepository<CollectionDefinitionEntity>;

  constructor(repositories: TenantRepositoryFactory) {
    this.rows = repositories.for(CollectionDefinitionEntity);
  }

  async insert(ctx: OperationContext, scope: StoreScope, definition: CollectionDefinition): Promise<void> {
    const row = {
      ...columnsOf(definition),
      id: definition.id,
      storeId: scope.storeId,
      collectionId: writableCollectionId(definition.collectionId),
    };
    const inserted = this.rows.insert(requestScope(ctx, scope), row);
    await onUniqueViolation(inserted, () => new CollectionRowConflictError('collections_definition'));
  }

  async findByCollectionId(
    ctx: OperationContext,
    scope: StoreScope,
    collectionId: string,
  ): Promise<CollectionDefinition | undefined> {
    const canonical = canonicalCoreId(collectionId);
    if (canonical === undefined) return undefined;
    const row = await this.rows.findOne(requestScope(ctx, scope), { storeId: scope.storeId, collectionId: canonical });
    return row === null ? undefined : toDefinition(row);
  }

  async list(ctx: OperationContext, scope: StoreScope, request: DefinitionListRequest): Promise<DefinitionPage> {
    const narrowedTo = request.collectionIds === undefined ? undefined : canonicalCoreIds(request.collectionIds);
    if (narrowedTo?.length === 0) return { items: [], totalItems: 0 };
    const tenant = requestScope(ctx, scope);
    const where = {
      storeId: scope.storeId,
      ...(narrowedTo === undefined ? {} : { collectionId: In(narrowedTo) }),
    };
    // One after the other: inside a transaction both share one connection (pg 9 refuses concurrent queries).
    const rows = await this.rows.find(tenant, { where, order: LIST_ORDER, skip: request.skip, take: request.take });
    const totalItems = await this.rows.count(tenant, where);
    return { items: rows.map(toDefinition), totalItems };
  }

  async listAutomatic(ctx: OperationContext, scope: StoreScope): Promise<readonly CollectionDefinition[]> {
    const automatic: CollectionMode = 'automatic';
    const rows = await this.rows.find(requestScope(ctx, scope), {
      where: { storeId: scope.storeId, mode: automatic },
      order: LIST_ORDER,
    });
    return rows.map(toDefinition);
  }

  async existing(
    ctx: OperationContext,
    scope: StoreScope,
    collectionIds: readonly string[],
  ): Promise<readonly string[]> {
    const canonical = canonicalCoreIds(collectionIds);
    if (canonical.length === 0) return [];
    const rows = await this.rows.find(requestScope(ctx, scope), {
      where: { storeId: scope.storeId, collectionId: In(canonical) },
      select: { collectionId: true },
    });
    const found = new Set(rows.map((row) => row.collectionId));
    return canonical.filter((collectionId) => found.has(collectionId));
  }

  async update(ctx: OperationContext, scope: StoreScope, definition: CollectionDefinition): Promise<boolean> {
    const canonical = canonicalCoreId(definition.collectionId);
    if (canonical === undefined) return false;
    const where = { storeId: scope.storeId, collectionId: canonical };
    return (await this.rows.update(requestScope(ctx, scope), where, columnsOf(definition))) > 0;
  }

  async delete(ctx: OperationContext, scope: StoreScope, collectionId: string): Promise<boolean> {
    const canonical = canonicalCoreId(collectionId);
    if (canonical === undefined) return false;
    return (await this.rows.delete(requestScope(ctx, scope), { storeId: scope.storeId, collectionId: canonical })) > 0;
  }

  countInStore(ctx: OperationContext, scope: StoreScope): Promise<number> {
    return this.rows.count(requestScope(ctx, scope), { storeId: scope.storeId });
  }
}
