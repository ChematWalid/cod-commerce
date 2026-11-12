import type { OperationContext } from '../../domain/ports/operation-context';

/** A repository over an empty store and the context its calls run in. */
export interface RepositoryHarness<R> {
  readonly repo: R;
  readonly ctx: OperationContext;
  /**
   * Runs `work` in a transaction opened on `ctx`, for calls that need one (a row lock); an in-memory store, which
   * has no transactions, omits it and the case runs on `ctx` itself.
   */
  readonly inTransaction?: <T>(work: (transactional: OperationContext) => Promise<T>) => Promise<T>;
}

/** Builds a fresh harness for one contract case. */
export type MakeHarness<R> = () => Promise<RepositoryHarness<R>>;
