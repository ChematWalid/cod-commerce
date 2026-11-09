import { TenantScoped } from '@cod/plugin-tenancy';
import { type PermissionKey, vendurePermissionName } from '@cod/shared';
import { Reflector } from '@nestjs/core';
import { Allow, type Permission, PERMISSIONS_METADATA_KEY } from '@vendure/core';

type AllowDecorator = ReturnType<typeof Allow>;

const reflector = new Reflector();
const CONSTRUCTOR = 'constructor';

/**
 * Vendure's `AuthGuard` reads `@Allow` from the handler only: on a class it is ignored and the handlers become
 * public. So the class form writes it on each handler, leaving one that declares its own.
 */
function allowEveryHandler(prototype: object, allow: AllowDecorator): void {
  for (const name of Object.getOwnPropertyNames(prototype)) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    if (name === CONSTRUCTOR || typeof descriptor?.value !== 'function') continue;
    const handler = descriptor.value as () => unknown;
    if (reflector.get<unknown>(PERMISSIONS_METADATA_KEY, handler) === undefined) {
      allow(prototype, name, descriptor);
    }
  }
}

/**
 * Requires the catalog permission on the active store and a tenant, on a resolver or controller method or on a
 * whole class (D58). Vendure's check on the active channel is the per-store check; a platform superadmin passes it
 * but has no tenant, so it fails closed. The consuming plugin must import `TenancyPlugin`.
 */
export function requirePermission(key: PermissionKey): MethodDecorator & ClassDecorator {
  // Custom permissions extend the enum at runtime only, so the compiler cannot know this name.
  const allow = Allow(vendurePermissionName(key) as unknown as Permission);
  const tenantScoped = TenantScoped();
  const decorate = (target: object, method?: string | symbol, descriptor?: PropertyDescriptor): void => {
    if (method === undefined || descriptor === undefined) {
      allowEveryHandler((target as { prototype: object }).prototype, allow);
      tenantScoped(target as never);
      return;
    }
    allow(target, method, descriptor);
    tenantScoped(target, method, descriptor);
  };
  return decorate;
}
