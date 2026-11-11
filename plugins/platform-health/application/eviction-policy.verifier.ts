import {
  LOGGER_CONTEXT,
  REDIS_EVICTION_GUARD_TIMEOUT_MS,
  REDIS_EVICTION_RECHECK_INTERVAL_MS,
} from '../domain/constants';
import { assertNoEvictionPolicy, isEvictionPolicyVerdict } from '../domain/eviction-policy';
import type { EvictionPolicyCheck, EvictionPolicyReader, WarnLogger } from '../domain/ports';
import { withTimeout } from '../domain/with-timeout';

const describeFailure = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Verifies that Valkey never evicts keys. Boot fails on a wrong or unverifiable policy, but not on an
 * unreachable Valkey: the redis readiness probe then verifies the policy before it ever reports ok.
 * A verification expires after `recheckMs`, so a policy changed later (a config reload, a failover to a node
 * with another policy) is noticed by the next readiness check.
 */
export class EvictionPolicyVerifier implements EvictionPolicyCheck {
  private verifiedAt: number | undefined;

  constructor(
    private readonly reader: EvictionPolicyReader,
    private readonly logger: WarnLogger,
    private readonly timeoutMs: number = REDIS_EVICTION_GUARD_TIMEOUT_MS,
    private readonly recheckMs: number = REDIS_EVICTION_RECHECK_INTERVAL_MS,
  ) {}

  /** True while the last read of the policy said `noeviction` and is younger than the re-check interval. */
  get verified(): boolean {
    return this.verifiedAt !== undefined && Date.now() - this.verifiedAt < this.recheckMs;
  }

  /**
   * @throws {RedisEvictionPolicyError} when the policy is not `noeviction`.
   * @throws {RedisConfigUnavailableError} when Valkey refuses `CONFIG GET`.
   * @throws {ProbeTimeoutError} or the connection error when Valkey is out of reach.
   */
  async verify(): Promise<void> {
    this.verifiedAt = undefined;
    assertNoEvictionPolicy(await withTimeout(() => this.reader.readEvictionPolicy(), this.timeoutMs));
    this.verifiedAt = Date.now();
  }

  /**
   * The boot-time guard. An unreachable Valkey is logged and boot continues, with `/readyz` not ready.
   *
   * @throws {RedisEvictionPolicyError} or {RedisConfigUnavailableError}, which fail boot.
   */
  async verifyAtBoot(): Promise<void> {
    try {
      await this.verify();
    } catch (error) {
      if (isEvictionPolicyVerdict(error)) {
        throw error;
      }
      this.logger.warn(
        `Valkey is unreachable at boot, so its maxmemory-policy is verified later by the readiness probe: ${describeFailure(error)}`,
        LOGGER_CONTEXT,
      );
    }
  }
}
