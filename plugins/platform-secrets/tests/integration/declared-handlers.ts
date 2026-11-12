import { PERMISSIONS_METADATA_KEY } from '@vendure/core';
import { PlatformSecretsPlugin } from '../../platform-secrets.plugin';

type Handler = (...args: never[]) => unknown;
type Class = abstract new (...args: never[]) => object;

const RESOLVER_TYPE = 'graphql:resolver_type';
const RESOLVER_NAME = 'graphql:resolver_name';
const ROOT_TYPES = new Set(['Query', 'Mutation']);

/** A handler of the code and the Vendure permission names its `@Allow` holds (`unguarded` when none). */
export interface DeclaredHandler {
  readonly key: string;
  readonly allow: string;
}

/** Every Admin API operation the plugin's resolver classes declare, keyed by operation name. */
export function declaredOperations(): DeclaredHandler[] {
  const extension = Reflect.getMetadata('adminApiExtensions', PlatformSecretsPlugin) as { resolvers: Class[] };
  return extension.resolvers.flatMap((resolver) => {
    const prototype = resolver.prototype as Record<string, Handler>;
    return Object.getOwnPropertyNames(prototype)
      .filter((name) => name !== 'constructor')
      .flatMap((name) => {
        const handler = prototype[name] as Handler;
        const type = Reflect.getMetadata(RESOLVER_TYPE, handler) as string | undefined;
        if (type === undefined || !ROOT_TYPES.has(type)) return [];
        const operation = (Reflect.getMetadata(RESOLVER_NAME, handler) as string | undefined) ?? name;
        const permissions = Reflect.getMetadata(PERMISSIONS_METADATA_KEY, handler) as string[] | undefined;
        return [{ key: operation, allow: permissions?.join(',') ?? 'unguarded' }];
      });
  });
}
