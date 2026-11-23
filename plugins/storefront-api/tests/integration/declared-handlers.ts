import { PERMISSIONS_METADATA_KEY } from '@vendure/core';
import { StorefrontApiPlugin } from '../../storefront-api.plugin';

type Handler = (...args: never[]) => unknown;
type Class = abstract new (...args: never[]) => object;

const REQUEST_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

function handlersOf(type: Class): Handler[] {
  const prototype = type.prototype as Record<string, Handler>;
  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .map((name) => prototype[name] as Handler);
}

/** The Vendure permission name a handler's `@Allow` holds, or `unguarded` when it has none. */
function allowedBy(handler: Handler): string {
  const permissions = Reflect.getMetadata(PERMISSIONS_METADATA_KEY, handler) as string[] | undefined;
  return permissions?.join(',') ?? 'unguarded';
}

/** A route of the code and what its `@Allow` says; the coverage test compares this with the registry. */
export interface DeclaredRoute {
  readonly key: string;
  readonly allow: string;
}

/** Every REST route the plugin's controllers declare, keyed `METHOD /path`, in declaration order. */
export function declaredRoutes(): DeclaredRoute[] {
  const controllers = Reflect.getMetadata('controllers', StorefrontApiPlugin) as Class[];
  return controllers.flatMap((controller) => {
    const base = Reflect.getMetadata('path', controller) as string;
    return handlersOf(controller).flatMap((handler) => {
      const path = Reflect.getMetadata('path', handler) as string | undefined;
      if (path === undefined) return [];
      const method = REQUEST_METHODS[Reflect.getMetadata('method', handler) as number];
      const route = `/${base}/${path}`.replaceAll(/\/+/g, '/').replace(/(.)\/$/, '$1');
      return [{ key: `${method ?? 'UNKNOWN'} ${route}`, allow: allowedBy(handler) }];
    });
  });
}
