import { Permission } from '@vendure/core';
import { AuthPlugin } from '../../auth.plugin';
import type { Access } from './endpoint-registry';

const ADMIN = 'admin';
const SHOP = 'shop';

type Handler = (...args: never[]) => unknown;
type Class = abstract new (...args: never[]) => object;

const RESOLVER_TYPE = 'graphql:resolver_type';
const RESOLVER_NAME = 'graphql:resolver_name';
const PERMISSIONS = '__permissions__';
const REQUEST_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
const ROOT_TYPES = new Set(['Query', 'Mutation']);

/** The handlers a class declares: its own methods other than the constructor. */
function handlersOf(type: Class): { name: string; handler: Handler }[] {
  const prototype = type.prototype as Record<string, Handler>;
  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .map((name) => ({ name, handler: prototype[name] as Handler }));
}

function accessOf(handler: Handler): Access | 'unguarded' {
  const permissions = Reflect.getMetadata(PERMISSIONS, handler) as string[] | undefined;
  if (permissions === undefined) {
    return 'unguarded';
  }
  if (permissions.includes(Permission.Public)) {
    return 'public';
  }
  return permissions.includes(Permission.Owner) ? 'owner' : 'business-update';
}

/** A handler of the code and what its `@Allow` says; the coverage test compares this with the registry. */
export interface DeclaredHandler {
  readonly key: string;
  readonly access: Access | 'unguarded';
}

/** Every GraphQL operation the plugin's resolver classes declare, keyed `api:operation`. */
export function declaredOperations(): DeclaredHandler[] {
  const apis = [
    [ADMIN, 'adminApiExtensions'],
    [SHOP, 'shopApiExtensions'],
  ] as const;
  return apis.flatMap(([api, metadataKey]) => {
    const extension = Reflect.getMetadata(metadataKey, AuthPlugin) as { resolvers: Class[] };
    return extension.resolvers.flatMap((resolver) =>
      handlersOf(resolver).flatMap(({ name, handler }) => {
        const type = Reflect.getMetadata(RESOLVER_TYPE, handler) as string | undefined;
        if (type === undefined || !ROOT_TYPES.has(type)) {
          return [];
        }
        const operation = (Reflect.getMetadata(RESOLVER_NAME, handler) as string | undefined) ?? name;
        return [{ key: `${api}:${operation}`, access: accessOf(handler) }];
      }),
    );
  });
}

/** Every REST route the plugin's controllers declare, keyed `METHOD /path`. */
export function declaredRoutes(): DeclaredHandler[] {
  const controllers = Reflect.getMetadata('controllers', AuthPlugin) as Class[];
  return controllers.flatMap((controller) => {
    const base = Reflect.getMetadata('path', controller) as string;
    return handlersOf(controller).flatMap(({ handler }) => {
      const path = Reflect.getMetadata('path', handler) as string | undefined;
      if (path === undefined) {
        return [];
      }
      const method = REQUEST_METHODS[Reflect.getMetadata('method', handler) as number];
      const route = `/${base}/${path}`.replaceAll(/\/+/g, '/').replace(/(.)\/$/, '$1');
      return [{ key: `${method ?? 'UNKNOWN'} ${route}`, access: accessOf(handler) }];
    });
  });
}
