import type { OperationContext } from '../../domain/ports/operation-context';
import type { PackLockPort } from '../../domain/ports/pack-lock.port';

/** {@link PackLockPort} that records each pack locked and runs `onAcquire`, standing in for a concurrent writer. */
export class RecordingPackLock implements PackLockPort {
  readonly acquired: string[] = [];
  onAcquire: (productId: string) => void = () => undefined;

  acquire(_ctx: OperationContext, productId: string): Promise<void> {
    this.acquired.push(productId);
    this.onAcquire(productId);
    return Promise.resolve();
  }
}
