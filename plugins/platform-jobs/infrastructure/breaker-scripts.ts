/** What `BREAKER_ADMIT_SCRIPT` tells a caller to do. */
export const ADMIT_CALL = 0;
export const ADMIT_PROBE = 1;
export const ADMIT_REJECT = 2;

/**
 * Decides whether a call may go through a breaker (D100). KEYS[1] the breaker record (hash: `openedAt`, and
 * `probeUntil` while a probe runs). ARGV: now in ms, open duration in ms, probe lease in ms.
 * Returns {decision, retryAfterMs}: closed calls go through; an open breaker rejects until it has been open for the
 * open duration; then exactly one caller at a time gets to probe, the others are rejected until its lease ends.
 */
export const BREAKER_ADMIT_SCRIPT = `
local openedAt = tonumber(redis.call('HGET', KEYS[1], 'openedAt'))
if openedAt == nil then
  return {${String(ADMIT_CALL)}, 0}
end
local nowMs = tonumber(ARGV[1])
local halfOpenAt = openedAt + tonumber(ARGV[2])
if nowMs < halfOpenAt then
  return {${String(ADMIT_REJECT)}, halfOpenAt - nowMs}
end
local probeUntil = tonumber(redis.call('HGET', KEYS[1], 'probeUntil'))
if probeUntil ~= nil and nowMs < probeUntil then
  return {${String(ADMIT_REJECT)}, probeUntil - nowMs}
end
redis.call('HSET', KEYS[1], 'probeUntil', nowMs + tonumber(ARGV[3]))
return {${String(ADMIT_PROBE)}, 0}
`;

/**
 * Records a failed call (D100). KEYS[1] the breaker record, KEYS[2] the failure set (scored by failure time).
 * ARGV: now in ms, 1 when the call was the probe, threshold, window in ms, failure token, record TTL in ms.
 * A failed probe reopens the breaker from now. A closed breaker counts failures in the window (now - window, now]
 * and opens at the threshold; a failure of a call admitted before another caller opened it changes nothing.
 * Returns 1 when the breaker is open afterwards.
 */
export const BREAKER_FAILURE_SCRIPT = `
local nowMs = tonumber(ARGV[1])
local function open()
  redis.call('DEL', KEYS[2])
  redis.call('HDEL', KEYS[1], 'probeUntil')
  redis.call('HSET', KEYS[1], 'openedAt', nowMs)
  redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[6]))
  return 1
end
if ARGV[2] == '1' then
  return open()
end
if redis.call('HEXISTS', KEYS[1], 'openedAt') == 1 then
  return 1
end
local windowMs = tonumber(ARGV[4])
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', nowMs - windowMs)
redis.call('ZADD', KEYS[2], nowMs, ARGV[5])
if redis.call('ZCARD', KEYS[2]) >= tonumber(ARGV[3]) then
  return open()
end
redis.call('PEXPIRE', KEYS[2], windowMs)
return 0
`;
