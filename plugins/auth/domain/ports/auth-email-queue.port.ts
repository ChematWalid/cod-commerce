import type { AuthEmailKind } from '../email';
import type { OperationContext } from './operation-context';

/** Puts a sealed email request on the worker queue once the caller's transaction has committed. */
export interface AuthEmailQueuePort {
  /**
   * `ctx` decides when the job is queued: with a transaction it waits for the commit and a rollback queues
   * nothing; a context without a transaction queues immediately. Callers inside a transaction must pass the
   * context they were given, never a fresh one. `kind` is only for logs: the payload stays sealed.
   */
  enqueue(ctx: OperationContext, sealed: string, kind: AuthEmailKind): Promise<void>;
}
