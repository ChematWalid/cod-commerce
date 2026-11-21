import type { RequestContext } from '@vendure/core';
import type { JobRowSource } from '../application/ports/job-repository.port';
import type { ImportsExportsJobData } from '../domain/imports-exports-job';
import type { StoreScope } from '../domain/store-scope';
import type { ImportsExportsJobRegistry } from './job-registry';

/** A handler of one `imports-exports` kind, as another plugin writes it: the row's store context and scope. */
export type ImportsExportsJobHandler = (
  data: ImportsExportsJobData,
  ctx: RequestContext,
  scope: StoreScope,
) => Promise<void>;

/**
 * What another plugin registers its `imports-exports` kinds on (D2212): P4.S2 adds order exports. The handler runs
 * under the business semaphore, in the store-channel context of the job row; the payload is never the scope. The
 * plugin stores its own job rows, so it brings their {@link JobRowSource} (D2252): the worker reads the row's scope,
 * status and actor through it, and fails the row through it.
 */
export interface ImportsExportsJobRegistrar {
  /**
   * Adds the handler of `kind`, its jobs opened from `rows`; call it from `onModuleInit`.
   * @throws Error when the kind already has a handler
   */
  register(kind: string, handler: ImportsExportsJobHandler, rows: JobRowSource): void;
}

/** DI token of the {@link ImportsExportsJobRegistrar}, exported from `@cod/plugin-catalog-import`. */
export const IMPORTS_EXPORTS_JOB_REGISTRAR = Symbol('catalog-import.ImportsExportsJobRegistrar');

/** The registrar over the registry: the opaque context the registry carries is the Vendure context it was built from. */
export function registrarOf(registry: ImportsExportsJobRegistry): ImportsExportsJobRegistrar {
  return {
    register: (kind, handler, rows) => {
      registry.register(kind, (data, ctx, scope) => handler(data, ctx as unknown as RequestContext, scope), rows);
    },
  };
}
