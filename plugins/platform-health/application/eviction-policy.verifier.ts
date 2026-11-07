import { LOGGER_CONTEXT, REDIS_EVICTION_GUARD_TIMEOUT_MS } from '../domain/constants';
import { assertNoEvictionPolicy, isEvictionPolicyVerdict } from '../domain/eviction-policy';
import type { EvictionPolicyCheck, EvictionPolicyReader, WarnLogger } from '../domain/ports';
import { withTimeout } from '../domain/with-timeout';

const describeFailure = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Verifies that Valkey never evicts keys. Boot fails on a wrong or unverifiable policy, but not on an
 * unreachable Valkey: the redis readiness probe then verifies the policy before it ever reports ok.
 */
export class EvictionPolicyVerifier implements EvictionPolicyCheck {
  private verifiedOnce = false;

  constructor(
    private readonly reader: EvictionPolicyReader,
    private readonly logger: WarnLogger,
    private readonly timeoutMs: number = REDIS_EVICTION_GUARD_TIMEOUT_MS,
  ) {}

  /** True once the policy has been read as `noeviction`; a running Valkey does not change it back. */
  get verified(): boolean {
    return this.verifiedOnce;
  }

  /**
   * @throws {RedisEvictionPolicyError} when the policy is not `noeviction`.
   * @throws {RedisConfigUnavailableError} when Valkey refuses `CONFIG GET`.
   * @throws {ProbeTimeoutError} or the connection error when Valkey is out of reach.
   */
  async verify(): Promise<void> {
    assertNoEvictionPolicy(await withTimeout(this.reader.readEvictionPolicy(), this.timeoutMs));
    this.verifiedOnce = true;
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
