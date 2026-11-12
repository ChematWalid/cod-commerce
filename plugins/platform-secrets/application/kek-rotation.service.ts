import { type BusinessId, DURABLE_JOB_KINDS, durableJobId } from '@cod/shared';
import { dataKeyAad } from '../domain/aad';
import { KEK_SCAN_BATCH_SIZE } from '../domain/constants';
import { SecretUnreadableError } from '../domain/errors';
import type { EnvelopeCipherPort, KekRing } from '../domain/ports/envelope-cipher.port';
import type {
  KekRewrapQueuePort,
  KekRewrapStorePort,
  RetiredKekScanPort,
  RewrappedKey,
} from '../domain/ports/kek-rotation.ports';
import type { DataKeyRecord } from '../domain/ports/secret-repositories.port';
import type { SecretLogger } from './tenant-secret.service';

/** The adapters behind the rotation: the scan, the job queue, the locked store and the log. */
export interface KekRotationPorts {
  readonly scan: RetiredKekScanPort;
  readonly queue: KekRewrapQueuePort;
  readonly store: KekRewrapStorePort;
  readonly logger: SecretLogger;
}

/** Everything the rotation needs. */
export interface KekRotationDependencies extends KekRotationPorts {
  /** The deployment's ring: its active kid is where `enqueueStale` wants every data key. */
  readonly ring: KekRing;
  readonly cipher: EnvelopeCipherPort;
  readonly clock: { now(): number };
}

/** The state of a rotation after a scan. */
export interface EnqueueStaleResult {
  readonly enqueued: number;
  /** Data keys still not wrapped by the active KEK when the scan ended (the ones just queued included until they run). */
  readonly remainingOnRetiredKeks: number;
}

/**
 * Moves every business's data key to the active KEK (D114). Only the small wrapped key changes; the secrets stay
 * sealed under the same data key. Both steps are safe to repeat: the job id is `kek-{business}-{kid}` and a rewrap of
 * a key already on the active KEK writes nothing.
 */
export class KekRotationService {
  constructor(private readonly deps: KekRotationDependencies) {}

  /** Queues a rewrap job for each data key off the active KEK, in pages, and reports what is left. */
  async enqueueStale(now: Date): Promise<EnqueueStaleResult> {
    const { scan, ring } = this.deps;
    let enqueued = 0;
    let after: string | null = null;
    for (;;) {
      const page: readonly string[] = await scan.staleBusinesses(ring.activeKid, after, KEK_SCAN_BATCH_SIZE);
      for (const businessId of page) {
        if (await this.enqueueOne(businessId, now)) enqueued += 1;
      }
      after = page.at(-1) ?? after;
      if (page.length < KEK_SCAN_BATCH_SIZE) break;
    }
    return { enqueued, remainingOnRetiredKeks: await scan.countStale(ring.activeKid) };
  }

  /**
   * Re-wraps the business's data key under `ring`'s active KEK, in one transaction holding the key's row lock.
   *
   * @returns `current` when the key is already on the active KEK (or the business has none).
   * @throws {SecretUnreadableError} when the KEK that wraps it is not in the ring, or the wrapped key is altered.
   */
  rewrap(businessId: BusinessId, ring: KekRing): Promise<'rewrapped' | 'current'> {
    return this.deps.store.rewrapLocked(
      businessId,
      (current) => this.plan(businessId, ring, current),
      new Date(this.deps.clock.now()),
    );
  }

  private plan(businessId: BusinessId, ring: KekRing, current: DataKeyRecord): RewrappedKey | undefined {
    if (current.kid === ring.activeKid) return undefined;
    const dek = this.open(businessId, ring, current);
    try {
      const active = ring.key(ring.activeKid);
      try {
        const wrapped = this.deps.cipher.seal(active, dek, dataKeyAad(businessId, ring.activeKid));
        return { kid: ring.activeKid, wrapped };
      } finally {
        active.fill(0);
      }
    } finally {
      dek.fill(0);
    }
  }

  private open(businessId: BusinessId, ring: KekRing, current: DataKeyRecord): Buffer {
    try {
      const kek = ring.key(current.kid);
      try {
        return this.deps.cipher.open(kek, current.wrapped, dataKeyAad(businessId, current.kid));
      } finally {
        kek.fill(0);
      }
    } catch {
      this.deps.logger.warn(`Data key cannot be re-wrapped: business ${businessId}, kid ${current.kid}`);
      throw new SecretUnreadableError();
    }
  }

  private async enqueueOne(businessId: string, now: Date): Promise<boolean> {
    try {
      await this.deps.queue.enqueue({
        jobId: durableJobId(DURABLE_JOB_KINDS.kekRewrap, businessId, this.deps.ring.activeKid),
        businessId,
        enqueuedAt: now.toISOString(),
      });
      return true;
    } catch (error) {
      // The key stays stale, so the next run tries again.
      this.deps.logger.warn(
        `Could not queue the data key rewrap of business ${businessId}: ${error instanceof Error ? error.name : typeof error}`,
      );
      return false;
    }
  }
}
