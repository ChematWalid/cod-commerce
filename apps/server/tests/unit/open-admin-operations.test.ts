import { TenantGuard } from '@cod/plugin-tenancy';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_METADATA_KEY } from '@vendure/core';
import { AdminApiModule } from '@vendure/core/dist/api/api-internal-modules';
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env';
import { buildPlugins } from '../../src/config/plugins.config';
import { TEST_ENV } from '../support/deployed-env.fixture';
import { REVIEWED_OPEN_OPERATIONS } from './open-admin-operations.reviewed';

type Handler = (...args: never[]) => unknown;
type Class = abstract new (...args: never[]) => object;

const RESOLVER_TYPE = 'graphql:resolver_type';
const RESOLVER_NAME = 'graphql:resolver_name';
const ROOT_TYPES = new Set(['Query', 'Mutation']);
/** Permissions that every signed-in administrator, or anyone, holds on some channel: none of them names a business. */
const OPEN_PERMISSIONS = new Set(['Authenticated', 'Owner', 'Public']);

interface AdminOperation {
  readonly name: string;
  readonly allow: readonly string[];
  readonly tenantScoped: boolean;
}

const guardsOf = (target: object): unknown[] =>
  (Reflect.getMetadata(GUARDS_METADATA, target) as unknown[] | undefined) ?? [];

/** The Query and Mutation handlers a resolver class declares. */
function operationsOf(resolver: Class): AdminOperation[] {
  const prototype = resolver.prototype as Record<string, Handler>;
  const classScoped = guardsOf(resolver).includes(TenantGuard);
  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .flatMap((name) => {
      const handler = prototype[name] as Handler;
      if (!ROOT_TYPES.has(Reflect.getMetadata(RESOLVER_TYPE, handler) as string)) return [];
      return [
        {
          name: (Reflect.getMetadata(RESOLVER_NAME, handler) as string | undefined) ?? name,
          allow: (Reflect.getMetadata(PERMISSIONS_METADATA_KEY, handler) as string[] | undefined) ?? [],
          tenantScoped: classScoped || guardsOf(handler).includes(TenantGuard),
        },
      ];
    });
}

/** The resolver classes a plugin adds to the Admin API. */
function pluginResolvers(plugin: unknown): Class[] {
  const extension = Reflect.getMetadata('adminApiExtensions', plugin as object) as
    { resolvers?: Class[] | (() => Class[]) } | undefined;
  const resolvers = extension?.resolvers ?? [];
  return typeof resolvers === 'function' ? resolvers() : resolvers;
}

/**
 * Every Admin API operation of the api role, as it answers at runtime: Vendure's own resolvers first, then the
 * plugins' in registration order, a later handler of the same name replacing an earlier one (as Vendure merges them).
 */
function adminOperations(): Map<string, AdminOperation> {
  const core = (Reflect.getMetadata('providers', AdminApiModule) as Class[]).filter(
    (type) => typeof type === 'function',
  );
  const plugins = buildPlugins(loadEnv({ ...TEST_ENV }), 'api').flatMap(pluginResolvers);
  const operations = new Map<string, AdminOperation>();
  for (const operation of [...core, ...plugins].flatMap(operationsOf)) {
    operations.set(operation.name, operation);
  }
  return operations;
}

const isOpen = ({ allow }: AdminOperation): boolean =>
  allow.length === 0 || allow.some((permission) => OPEN_PERMISSIONS.has(permission));

/**
 * The gate behind D500. An operation every signed-in administrator can call, with no tenant guard, answers the same
 * whatever business the caller belongs to; if it reads a tenant table it reads every business's rows. Each one must
 * be reviewed and listed with the reason it is safe, so a new one (from a Vendure upgrade or a plugin) fails here.
 */
describe('Admin API operations open to every administrator', () => {
  const operations = adminOperations();

  it('finds the stock operations it reads, so an empty result cannot pass silently', () => {
    expect(operations.get('me')?.allow).toContain('Authenticated');
    expect(operations.size).toBeGreaterThan(200);
  });

  it('lets only the superadmin and platform staff call slugForEntity (D500)', () => {
    expect(operations.get('slugForEntity')?.allow).toEqual(['SuperAdmin', 'PlatformStaff']);
  });

  it('lists every open operation without a tenant guard as reviewed, and nothing else', () => {
    const unguardedOpen = [...operations.values()]
      .filter((operation) => isOpen(operation) && !operation.tenantScoped)
      .map((operation) => operation.name)
      .sort();

    expect(unguardedOpen).toEqual(Object.keys(REVIEWED_OPEN_OPERATIONS).sort());
  });
});
