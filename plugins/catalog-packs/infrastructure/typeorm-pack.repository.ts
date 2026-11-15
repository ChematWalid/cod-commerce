import type { SnowflakeIdGeneratorPort, TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { In } from 'typeorm';
import type { PackRecord } from '../domain/pack';
import type { OperationContext } from '../domain/ports/operation-context';
import type { PackRepositoryPort, PackSave, PackStatusChange } from '../domain/ports/pack-repository.port';
import type { StoreScope } from '../domain/store-scope';
import { PackComponentEntity } from './pack-component.entity';
import { modeColumnsOf, packRecordOf } from './pack-rows';
import { PackEntity } from './pack.entity';
import { requestScope } from './request-scope';

/** The store half of a row filter; `TenantRepository` adds the business itself (ADR 0002). */
const inStore = (scope: StoreScope): { storeId: string } => ({ storeId: scope.storeId });

/**
 * The Postgres adapter of {@link PackRepositoryPort}: `catalog_pack` and `catalog_pack_component` through
 * `TenantRepository` (ADR 0002). Every call joins the transaction `ctx` carries, so a save is atomic in one.
 */
export class TypeOrmPackRepository implements PackRepositoryPort {
  private readonly packs: TenantRepository<PackEntity>;
  private readonly components: TenantRepository<PackComponentEntity>;

  constructor(
    repositories: TenantRepositoryFactory,
    private readonly ids: SnowflakeIdGeneratorPort,
  ) {
    this.packs = repositories.for(PackEntity);
    this.components = repositories.for(PackComponentEntity);
  }

  async findByProduct(ctx: OperationContext, scope: StoreScope, productId: string): Promise<PackRecord | undefined> {
    const tenant = requestScope(ctx, scope);
    const row = await this.packs.findOne(tenant, { ...inStore(scope), productId: Number(productId) });
    return row === null ? undefined : this.recordOf(ctx, scope, row);
  }

  async holding(ctx: OperationContext, scope: StoreScope, productId: string): Promise<readonly PackRecord[]> {
    const tenant = requestScope(ctx, scope);
    const lines = await this.components.find(tenant, { where: { ...inStore(scope), productId: Number(productId) } });
    const packIds = [...new Set(lines.map((line) => line.packId))];
    if (packIds.length === 0) return [];
    const rows = await this.packs.find(tenant, { where: { ...inStore(scope), id: In(packIds) }, order: { id: 'ASC' } });
    return Promise.all(rows.map((row) => this.recordOf(ctx, scope, row)));
  }

  async save(ctx: OperationContext, scope: StoreScope, pack: PackSave): Promise<PackRecord> {
    const tenant = requestScope(ctx, scope);
    const productId = Number(pack.productId);
    const existing = await this.packs.findOne(tenant, { ...inStore(scope), productId });
    const now = new Date();
    const columns = { ...modeColumnsOf(pack.definition), status: pack.status, updatedAt: now };
    const id = existing?.id ?? this.ids.next();
    if (existing === null) {
      await this.packs.insert(tenant, { id, ...inStore(scope), productId, ...columns, createdAt: now });
    } else {
      await this.packs.update(tenant, { ...inStore(scope), id }, columns);
      await this.components.delete(tenant, { ...inStore(scope), packId: id });
    }
    await this.insertComponents(ctx, scope, { packId: id, pack });
    const saved = await this.packs.findOne(tenant, { ...inStore(scope), id });
    if (saved === null) throw new Error('A saved pack row was not found in its own transaction');
    return this.recordOf(ctx, scope, saved);
  }

  async setStatus(ctx: OperationContext, scope: StoreScope, change: PackStatusChange): Promise<void> {
    const where = { ...inStore(scope), id: change.packId };
    await this.packs.update(requestScope(ctx, scope), where, { status: change.status, updatedAt: new Date() });
  }

  async deleteByProduct(ctx: OperationContext, scope: StoreScope, productId: string): Promise<void> {
    const tenant = requestScope(ctx, scope);
    const row = await this.packs.findOne(tenant, { ...inStore(scope), productId: Number(productId) });
    if (row === null) return;
    await this.components.delete(tenant, { ...inStore(scope), packId: row.id });
    await this.packs.delete(tenant, { ...inStore(scope), id: row.id });
  }

  private async insertComponents(
    ctx: OperationContext,
    scope: StoreScope,
    { packId, pack }: { packId: string; pack: PackSave },
  ): Promise<void> {
    const tenant = requestScope(ctx, scope);
    for (const [position, line] of pack.definition.components.entries()) {
      await this.components.insert(tenant, {
        id: this.ids.next(),
        ...inStore(scope),
        packId,
        position,
        productId: Number(line.productId),
        variantId: line.variantId === null ? null : Number(line.variantId),
        quantity: line.quantity,
      });
    }
  }

  private async recordOf(ctx: OperationContext, scope: StoreScope, row: PackEntity): Promise<PackRecord> {
    const lines = await this.components.find(requestScope(ctx, scope), {
      where: { ...inStore(scope), packId: row.id },
      order: { position: 'ASC' },
    });
    return packRecordOf(row, lines);
  }
}
