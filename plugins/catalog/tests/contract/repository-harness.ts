import type { OperationContext } from '../../domain/ports/operation-context';

/** A repository over an empty store and the context its calls run in. */
export interface RepositoryHarness<R> {
  readonly repo: R;
  readonly ctx: OperationContext;
}

/** Builds a fresh harness for one contract case. */
export type MakeHarness<R> = () => Promise<RepositoryHarness<R>>;
