/** What `BREAKER_ADMIT_SCRIPT` tells a caller to do. */
export const ADMIT_CALL = 0;
export const ADMIT_PROBE = 1;
export const ADMIT_REJECT = 2;

/**
 * Decides whether a call may go through a breaker (D103). KEYS[1] the breaker record (hash: `openedAt`, and
 * `probeUntil` and `probeToken` while a probe runs). ARGV: now in ms, open duration in ms, probe lease in ms,
 * the caller's token (kept when it becomes the probe, so only that probe's outcome counts).
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
redis.call('HSET', KEYS[1], 'probeUntil', nowMs + tonumber(ARGV[3]), 'probeToken', ARGV[4])
return {${String(ADMIT_PROBE)}, 0}
`;

/**
 * Records a failed call (D103). KEYS[1] the breaker record, KEYS[2] the failure set (scored by failure time).
 * ARGV: now in ms, the probe token ('' when the call was not a probe), threshold, window in ms, failure token,
 * record TTL in ms. A failed probe reopens the breaker from now, unless its lease ran out and another probe took
 * over (its token no longer matches). A closed breaker counts failures in the window (now - window, now] and
 * opens at the threshold; a failure of a call admitted before another caller opened it changes nothing.
 * Returns 1 when the breaker is open afterwards.
 */
export const BREAKER_FAILURE_SCRIPT = `
local nowMs = tonumber(ARGV[1])
local function open()
  redis.call('DEL', KEYS[2])
  redis.call('HDEL', KEYS[1], 'probeUntil', 'probeToken')
  redis.call('HSET', KEYS[1], 'openedAt', nowMs)
  redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[6]))
  return 1
end
if ARGV[2] ~= '' then
  if redis.call('HGET', KEYS[1], 'probeToken') == ARGV[2] then
    return open()
  end
  return redis.call('HEXISTS', KEYS[1], 'openedAt')
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

/**
 * Closes a breaker after a successful probe (D103), only while that probe still holds the probe lease: a late
 * success of a probe whose lease ran out must not close a breaker that a newer probe has reopened.
 * KEYS[1] the breaker record, KEYS[2] the failure set; ARGV[1] the probe token. Returns 1 when it closed.
 */
export const BREAKER_PROBE_SUCCESS_SCRIPT = `
if redis.call('HGET', KEYS[1], 'probeToken') ~= ARGV[1] then
  return 0
end
redis.call('DEL', KEYS[1], KEYS[2])
return 1
`;
