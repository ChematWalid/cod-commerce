import type { TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { COLLECTION_MODES, type CollectionMode, type CollectionRule, collectionRuleSchema } from '@cod/shared';
import { In } from 'typeorm';
import type { CollectionDefinition } from '../domain/collection';
import { InvalidCollectionRuleError } from '../domain/errors';
import type {
  CollectionDefinitionRepositoryPort,
  DefinitionListRequest,
  DefinitionPage,
} from '../domain/ports/collection-definition-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import { CollectionDefinitionEntity } from './collection-definition.entity';
import { requestScope } from './request-scope';

/** The order of every list of definitions (D2318). */
const LIST_ORDER = { position: 'ASC', id: 'ASC' } as const;

const isMode = (value: string): value is CollectionMode => (COLLECTION_MODES as readonly string[]).includes(value);

/** A stored rule read back through the shared schema, so a row edited by hand never reaches the evaluator untyped. */
function ruleOf(stored: unknown): CollectionRule | null {
  if (stored === null || stored === undefined) return null;
  const parsed = collectionRuleSchema.safeParse(stored);
  if (!parsed.success) throw new InvalidCollectionRuleError();
  return parsed.data;
}

function toDefinition(row: CollectionDefinitionEntity): CollectionDefinition {
  if (!isMode(row.mode) || row.storeId === null) throw new InvalidCollectionRuleError();
  return {
    id: row.id,
    collectionId: row.collectionId,
    storeId: row.storeId,
    mode: row.mode,
    rule: ruleOf(row.rule),
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

/** The Postgres adapter of {@link CollectionDefinitionRepositoryPort} through `TenantRepository` (ADR 0002). */
export class TypeOrmCollectionDefinitionRepository implements CollectionDefinitionRepositoryPort {
  private readonly rows: TenantRepository<CollectionDefinitionEntity>;

  constructor(repositories: TenantRepositoryFactory) {
    this.rows = repositories.for(CollectionDefinitionEntity);
  }

  async insert(ctx: OperationContext, scope: StoreScope, definition: CollectionDefinition): Promise<void> {
    await this.rows.insert(requestScope(ctx, scope), {
      id: definition.id,
      storeId: scope.storeId,
      collectionId: definition.collectionId,
      ...columnsOf(definition),
    });
  }

  async findByCollectionId(
    ctx: OperationContext,
    scope: StoreScope,
    collectionId: string,
  ): Promise<CollectionDefinition | undefined> {
    const row = await this.rows.findOne(requestScope(ctx, scope), { storeId: scope.storeId, collectionId });
    return row === null ? undefined : toDefinition(row);
  }

  async list(ctx: OperationContext, scope: StoreScope, request: DefinitionListRequest): Promise<DefinitionPage> {
    if (request.collectionIds?.length === 0) return { items: [], totalItems: 0 };
    const tenant = requestScope(ctx, scope);
    const where = {
      storeId: scope.storeId,
      ...(request.collectionIds === undefined ? {} : { collectionId: In([...request.collectionIds]) }),
    };
    const [rows, totalItems] = await Promise.all([
      this.rows.find(tenant, { where, order: LIST_ORDER, skip: request.skip, take: request.take }),
      this.rows.count(tenant, where),
    ]);
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
    if (collectionIds.length === 0) return [];
    const rows = await this.rows.find(requestScope(ctx, scope), {
      where: { storeId: scope.storeId, collectionId: In([...collectionIds]) },
      select: { collectionId: true },
    });
    const found = new Set(rows.map((row) => row.collectionId));
    return collectionIds.filter((collectionId) => found.has(collectionId));
  }

  async update(ctx: OperationContext, scope: StoreScope, definition: CollectionDefinition): Promise<boolean> {
    const where = { storeId: scope.storeId, collectionId: definition.collectionId };
    return (await this.rows.update(requestScope(ctx, scope), where, columnsOf(definition))) > 0;
  }

  async delete(ctx: OperationContext, scope: StoreScope, collectionId: string): Promise<boolean> {
    return (await this.rows.delete(requestScope(ctx, scope), { storeId: scope.storeId, collectionId })) > 0;
  }

  countInStore(ctx: OperationContext, scope: StoreScope): Promise<number> {
    return this.rows.count(requestScope(ctx, scope), { storeId: scope.storeId });
  }
}
