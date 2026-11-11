/** `SEMAPHORE_ACQUIRE_SCRIPT` answers this when it took a lease. */
export const LEASE_TAKEN = 1;

/**
 * Takes one lease of a business semaphore in one round trip (D103). The set holds one member per holder, scored by
 * the time its lease ends, so a holder whose process died stops counting once its lease is over.
 *
 * KEYS[1] the lease set; ARGV: now in ms, limit, lease in ms, holder token. Returns 1 when taken, 0 when busy.
 * The caller's clock is passed in so that every process and the tests agree on one notion of time.
 */
export const SEMAPHORE_ACQUIRE_SCRIPT = `
local nowMs = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local leaseMs = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', nowMs)
if redis.call('ZCARD', KEYS[1]) >= limit then
  return 0
end
redis.call('ZADD', KEYS[1], nowMs + leaseMs, ARGV[4])
redis.call('PEXPIRE', KEYS[1], leaseMs)
return 1
`;
