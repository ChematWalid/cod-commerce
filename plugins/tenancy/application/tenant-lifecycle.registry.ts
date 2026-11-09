import type {
  BusinessProvisionedEvent,
  StoreCreatedEvent,
  TenantLifecycleHook,
} from '../domain/ports/tenant-lifecycle.port';
import type { OperationContext } from '../domain/ports/operation-context';

/** What other plugins get: they may add a hook, never fire events themselves. */
export interface TenantLifecycleRegistrar {
  register(hook: TenantLifecycleHook): void;
}

/**
 * The hooks other plugins registered, run one after another in registration order. It is itself a hook, so the use
 * cases call it as one. The first hook to throw stops the rest and fails the caller's transaction.
 */
export class TenantLifecycleRegistry implements TenantLifecycleHook, TenantLifecycleRegistrar {
  private readonly hooks: TenantLifecycleHook[] = [];

  /** Adds `hook` after the ones already registered; the same hook registered twice runs once. */
  register(hook: TenantLifecycleHook): void {
    if (this.hooks.includes(hook)) return;
    this.hooks.push(hook);
  }

  async businessProvisioned(ctx: OperationContext, event: BusinessProvisionedEvent): Promise<void> {
    for (const hook of this.hooks) {
      await hook.businessProvisioned(ctx, event);
    }
  }

  async storeCreated(ctx: OperationContext, event: StoreCreatedEvent): Promise<void> {
    for (const hook of this.hooks) {
      await hook.storeCreated(ctx, event);
    }
  }
}
