/** The part of a Vendure-style logger this plugin uses; the static Vendure `Logger` satisfies it. */
export interface WarnLogger {
  warn(message: string, context?: string): void;
}

/** Reads Valkey's `maxmemory-policy`. */
export interface EvictionPolicyReader {
  /**
   * @throws {RedisConfigUnavailableError} when Valkey refuses `CONFIG GET`; any other error means Valkey
   * could not be reached.
   */
  readEvictionPolicy(): Promise<string>;
}

/** Whether Valkey's eviction policy has been verified, and a way to verify it. */
export interface EvictionPolicyCheck {
  readonly verified: boolean;
  /** @throws {RedisEvictionPolicyError} when the policy is wrong; rejects too when it cannot be read. */
  verify(): Promise<void>;
}
