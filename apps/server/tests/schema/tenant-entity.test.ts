import { TenantEntity } from '@cod/plugin-tenancy';
import { describe, expect, it } from 'vitest';
import { getMetadataArgsStorage } from 'typeorm';
import { MetadataUtils } from 'typeorm/metadata-builder/MetadataUtils';
import packageJson from '../../package.json';

type EntityClass = abstract new (...args: never[]) => object;

const PLUGIN_PACKAGE_PREFIX = '@cod/plugin-';
const ENTITIES_METADATA = 'entities';
const BUSINESS_ID_COLUMN = 'businessId';

/**
 * Rows of the tenant root, not owned by one: a business has no business, its sequence is keyed by it. An account
 * token has no business, and a task heartbeat is one row per scheduled task (D24, D108).
 */
const NOT_TENANT_OWNED = [
  'BusinessEntity',
  'BusinessOrderSequenceEntity',
  'AccountTokenEntity',
  'TaskHeartbeatEntity',
  'InboundWebhookKeyEntity',
  // Staff-managed flag configuration; an override's business or store id is a target, not an owner (D108).
  'FeatureFlagEntity',
  'FeatureFlagOverrideEntity',
];

/** A plugin's `entities` metadata, an array or the function form `entities: () => [...]`. */
const declaredEntities = (candidate: unknown): EntityClass[] => {
  if (typeof candidate !== 'function') return [];
  const entities = Reflect.getMetadata(ENTITIES_METADATA, candidate) as
    EntityClass[] | (() => EntityClass[]) | undefined;
  const resolved = typeof entities === 'function' ? entities() : entities;
  return resolved ?? [];
};

/** The entities of every `@cod/plugin-*` the server depends on, so a new plugin is covered without an edit here. */
async function pluginEntities(): Promise<EntityClass[]> {
  const packages = Object.keys(packageJson.dependencies).filter((name) => name.startsWith(PLUGIN_PACKAGE_PREFIX));
  const modules = await Promise.all(packages.map(async (name) => (await import(name)) as Record<string, unknown>));
  return modules.flatMap((module) => Object.values(module).flatMap(declaredEntities));
}

function businessIdShape(entity: EntityClass): { nullable: boolean; indexed: boolean } {
  const storage = getMetadataArgsStorage();
  const tree = MetadataUtils.getInheritanceTree(entity);
  const column = storage.filterColumns(tree).find((candidate) => candidate.propertyName === BUSINESS_ID_COLUMN);
  const indexed = storage
    .filterIndices(tree)
    .some((index) => JSON.stringify(index.columns) === JSON.stringify([BUSINESS_ID_COLUMN]));
  return { nullable: column === undefined || column.options.nullable === true, indexed };
}

describe('tenant-owned entities', () => {
  it('covers the entities it says it does', async () => {
    // Act
    const names = (await pluginEntities()).map((entity) => entity.name);

    // Assert
    expect(names).toEqual(expect.arrayContaining([...NOT_TENANT_OWNED, 'NoteEntity', 'StoreEntity']));
  });

  it('every plugin entity extends TenantEntity with a NOT NULL indexed businessId', async () => {
    // Arrange
    const tenantOwned = (await pluginEntities()).filter((entity) => !NOT_TENANT_OWNED.includes(entity.name));

    // Act
    const violations = tenantOwned.flatMap((entity) => {
      const { nullable, indexed } = businessIdShape(entity);
      const extendsBase = entity.prototype instanceof TenantEntity;
      return extendsBase && !nullable && indexed ? [] : [{ entity: entity.name, extendsBase, nullable, indexed }];
    });

    // Assert
    expect(violations).toEqual([]);
  });
});
