import { PERMISSIONS_METADATA_KEY } from '@vendure/core';
import { vendurePermissionName } from '@cod/shared';
import { RbacPlugin } from '../../rbac.plugin';
import type { Access } from './endpoint-registry';

type Handler = (...args: never[]) => unknown;
type Class = abstract new (...args: never[]) => object;

const RESOLVER_TYPE = 'graphql:resolver_type';
const RESOLVER_NAME = 'graphql:resolver_name';
const REQUEST_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
const ROOT_TYPES = new Set(['Query', 'Mutation']);
const AUTHENTICATED = 'Authenticated';

/** The handlers a class declares: its own methods other than the constructor. */
function handlersOf(type: Class): { name: string; handler: Handler }[] {
  const prototype = type.prototype as Record<string, Handler>;
  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .map((name) => ({ name, handler: prototype[name] as Handler }));
}

/** The Vendure permission name a handler's `@Allow` holds, or `unguarded` when it has none. */
function allowedBy(handler: Handler): string {
  const permissions = Reflect.getMetadata(PERMISSIONS_METADATA_KEY, handler) as string[] | undefined;
  return permissions?.join(',') ?? 'unguarded';
}

/** The Vendure permission name an {@link Access} stands for. */
export const permissionNameOf = (access: Access): string =>
  access === 'authenticated' ? AUTHENTICATED : vendurePermissionName(access);

/** A handler of the code and what its `@Allow` says; the coverage test compares this with the registry. */
export interface DeclaredHandler {
  readonly key: string;
  readonly allow: string;
}

/** Every Admin API operation the plugin's resolver classes declare, keyed by operation name. */
export function declaredOperations(): DeclaredHandler[] {
  const extension = Reflect.getMetadata('adminApiExtensions', RbacPlugin) as { resolvers: Class[] };
  return extension.resolvers.flatMap((resolver) =>
    handlersOf(resolver).flatMap(({ name, handler }) => {
      const type = Reflect.getMetadata(RESOLVER_TYPE, handler) as string | undefined;
      if (type === undefined || !ROOT_TYPES.has(type)) return [];
      const operation = (Reflect.getMetadata(RESOLVER_NAME, handler) as string | undefined) ?? name;
      return [{ key: operation, allow: allowedBy(handler) }];
    }),
  );
}

/** Every REST route the plugin's controllers declare, keyed `METHOD /path`. */
export function declaredRoutes(): DeclaredHandler[] {
  const controllers = Reflect.getMetadata('controllers', RbacPlugin) as Class[];
  return controllers.flatMap((controller) => {
    const base = Reflect.getMetadata('path', controller) as string;
    return handlersOf(controller).flatMap(({ handler }) => {
      const path = Reflect.getMetadata('path', handler) as string | undefined;
      if (path === undefined) return [];
      const method = REQUEST_METHODS[Reflect.getMetadata('method', handler) as number];
      const route = `/${base}/${path}`.replaceAll(/\/+/g, '/').replace(/(.)\/$/, '$1');
      return [{ key: `${method ?? 'UNKNOWN'} ${route}`, allow: allowedBy(handler) }];
    });
  });
}
