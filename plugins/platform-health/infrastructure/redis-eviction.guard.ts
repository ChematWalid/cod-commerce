import { RedisConfigUnavailableError } from '../domain/eviction-policy';
import type { EvictionPolicyReader } from '../domain/ports';
import { ensureConnected, type ConnectableClient } from './redis.probe';

/** What the reader needs from a Valkey client: connecting and `CONFIG GET`. */
export interface RedisConfigClient extends ConnectableClient {
  config(subcommand: 'GET', parameter: string): Promise<unknown>;
}

const POLICY_PARAMETER = 'maxmemory-policy';
const UNKNOWN_POLICY = 'unknown';

/** Replies of a Valkey that disabled `CONFIG` (renamed command) or denies it through an ACL. */
const CONFIG_REFUSED_REPLY = /^(ERR unknown command|NOPERM)/i;

/** `CONFIG GET` answers a flat `[name, value]` list. */
const policyOf = (reply: unknown): string => {
  if (!Array.isArray(reply)) {
    return UNKNOWN_POLICY;
  }
  const value: unknown = reply[1];
  return typeof value === 'string' ? value : UNKNOWN_POLICY;
};

const isConfigRefused = (error: unknown): boolean => error instanceof Error && CONFIG_REFUSED_REPLY.test(error.message);

/** Reads `maxmemory-policy` with `CONFIG GET` over the probe client. */
export class RedisEvictionPolicyReader implements EvictionPolicyReader {
  constructor(private readonly client: RedisConfigClient) {}

  /** @throws {RedisConfigUnavailableError} when Valkey refuses `CONFIG GET`; connection errors propagate. */
  async readEvictionPolicy(): Promise<string> {
    await ensureConnected(this.client);
    try {
      return policyOf(await this.client.config('GET', POLICY_PARAMETER));
    } catch (error) {
      if (isConfigRefused(error)) {
        throw new RedisConfigUnavailableError();
      }
      throw error;
    }
  }
}
