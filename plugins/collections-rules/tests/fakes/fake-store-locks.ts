import type { OperationContext } from '../../domain/ports/operation-context';

/**
 * Per-store mutexes held until the fake transaction ends, like `pg_advisory_xact_lock` (D2334): a second transaction
 * of the same store waits for the first one to end, a transaction that holds the lock takes it again at once.
 */
export class FakeStoreLocks {
  private readonly tails = new Map<string, Promise<void>>();
  private readonly releases = new Map<OperationContext, Map<string, () => void>>();

  /** Starts a transaction whose locks {@link end} releases. */
  begin(tx: OperationContext): void {
    this.releases.set(tx, new Map());
  }

  isTransaction(ctx: OperationContext): boolean {
    return this.releases.has(ctx);
  }

  async acquire(tx: OperationContext, storeId: string): Promise<void> {
    const held = this.releases.get(tx);
    if (held === undefined) throw new Error('The store lock must be taken inside a transaction');
    if (held.has(storeId)) return;
    const previous = this.tails.get(storeId) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.tails.set(
      storeId,
      previous.then(() => current),
    );
    held.set(storeId, release);
    await previous;
  }

  end(tx: OperationContext): void {
    for (const release of this.releases.get(tx)?.values() ?? []) release();
    this.releases.delete(tx);
  }
}
