/**
 * Token bucket in one round trip. It is `takeToken` (domain/token-bucket.ts) in Lua and must stay equal to it:
 * refill from the stored stamp, take a token if one is there, otherwise take nothing and report the wait.
 *
 * KEYS[1] bucket hash; ARGV: capacity, window in ms, and optionally now in ms (tests only).
 * Returns {allowed, retryAfterSeconds, exhausted}.
 * "Now" is Valkey's own clock (`TIME`), so api processes whose clocks differ still agree on refill. A stamp
 * in the future (a clock that was ahead) counts as now, so it cannot freeze refill for that key.
 */
export const TOKEN_BUCKET_SCRIPT = `
local capacity = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local nowMs = tonumber(ARGV[3])
if nowMs == nil then
  local time = redis.call('TIME')
  nowMs = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
end
local stored = redis.call('HMGET', KEYS[1], 't', 'u')
local tokens = tonumber(stored[1])
local updated = tonumber(stored[2])
if tokens == nil or updated == nil then
  tokens = capacity
  updated = nowMs
end
if updated > nowMs then
  updated = nowMs
end
local elapsed = nowMs - updated
tokens = math.min(capacity, tokens + elapsed * capacity / windowMs)
local allowed = 0
local retry = 0
local exhausted = 1
if tokens + 1e-9 >= 1 then
  tokens = tokens - 1
  allowed = 1
  if tokens + 1e-9 >= 1 then
    exhausted = 0
  end
else
  local waitMs = math.floor((1 - tokens) * windowMs / capacity + 0.5)
  retry = math.max(1, math.ceil(waitMs / 1000))
end
redis.call('HSET', KEYS[1], 't', tostring(tokens), 'u', tostring(nowMs))
redis.call('PEXPIRE', KEYS[1], windowMs)
return {allowed, retry, exhausted}
`;

/**
 * Gives one token back in one round trip. It is `returnToken` (domain/token-bucket.ts) in Lua and must stay
 * equal to it: refill from the stored stamp to now, add one token, never above capacity. A missing bucket is
 * full, so nothing is written.
 *
 * KEYS[1] bucket hash; ARGV: capacity, window in ms, and optionally now in ms (tests only). Returns 1 when a
 * token was put back, 0 when the bucket was already gone.
 */
export const REFUND_SCRIPT = `
local capacity = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local nowMs = tonumber(ARGV[3])
if nowMs == nil then
  local time = redis.call('TIME')
  nowMs = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
end
local stored = redis.call('HMGET', KEYS[1], 't', 'u')
local tokens = tonumber(stored[1])
local updated = tonumber(stored[2])
if tokens == nil or updated == nil then
  return 0
end
if updated > nowMs then
  updated = nowMs
end
local elapsed = nowMs - updated
tokens = math.min(capacity, tokens + elapsed * capacity / windowMs + 1)
redis.call('HSET', KEYS[1], 't', tostring(tokens), 'u', tostring(nowMs))
redis.call('PEXPIRE', KEYS[1], windowMs)
return 1
`;

/**
 * Starts the next lockout of a key: twice the previous one, 60 s the first time, never above the cap.
 * KEYS[1] the lock (expires when the lockout ends), KEYS[2] the memory of its length.
 * ARGV: initial seconds, max seconds, memory seconds, growth factor. Returns the length in seconds.
 */
export const LOCKOUT_SCRIPT = `
local previous = tonumber(redis.call('GET', KEYS[2])) or 0
local duration = tonumber(ARGV[1])
if previous > 0 then
  duration = math.min(previous * tonumber(ARGV[4]), tonumber(ARGV[2]))
end
redis.call('SET', KEYS[1], '1', 'EX', duration)
redis.call('SET', KEYS[2], tostring(duration), 'EX', duration + tonumber(ARGV[3]))
return duration
`;
