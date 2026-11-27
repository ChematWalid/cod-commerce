import { PERMISSIONS_METADATA_KEY } from '@vendure/core';
import { GeoPlugin } from '../../geo.plugin';

type Handler = (...args: never[]) => unknown;
type Class = abstract new (...args: never[]) => object;

const REQUEST_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
/** The metadata key `@RateLimit` stores its policy under (`plugins/rate-limit/api/rate-limit.metadata.ts`). */
const RATE_LIMIT_METADATA = 'cod:rate-limit-policy';

/** A route of the code: its key, what its `@Allow` says and its `@RateLimit` policy. */
export interface DeclaredRoute {
  readonly key: string;
  readonly allow: string;
  readonly rateLimit: string | undefined;
}

function handlersOf(type: Class): Handler[] {
  const prototype = type.prototype as Record<string, Handler>;
  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .map((name) => prototype[name] as Handler);
}

/** The Vendure permission names a handler's `@Allow` holds, or `unguarded` when it has none. */
function allowedBy(handler: Handler): string {
  const permissions = Reflect.getMetadata(PERMISSIONS_METADATA_KEY, handler) as string[] | undefined;
  return permissions?.join(',') ?? 'unguarded';
}

/** Every REST route the plugin's controllers declare, keyed `METHOD /path`. */
export function declaredRoutes(): DeclaredRoute[] {
  const controllers = Reflect.getMetadata('controllers', GeoPlugin) as Class[];
  return controllers.flatMap((controller) => {
    const base = Reflect.getMetadata('path', controller) as string;
    return handlersOf(controller).flatMap((handler) => {
      const path = Reflect.getMetadata('path', handler) as string | undefined;
      if (path === undefined) return [];
      const method = REQUEST_METHODS[Reflect.getMetadata('method', handler) as number];
      const route = `/${base}/${path}`.replaceAll(/\/+/g, '/').replace(/(.)\/$/, '$1');
      return [
        {
          key: `${method ?? 'UNKNOWN'} ${route}`,
          allow: allowedBy(handler),
          rateLimit: Reflect.getMetadata(RATE_LIMIT_METADATA, handler) as string | undefined,
        },
      ];
    });
  });
}
