/**
 * Token bucket in one round trip. It is `takeToken` (domain/token-bucket.ts) in Lua and must stay equal to it:
 * refill from the stored stamp, take a token if one is there, otherwise take nothing and report the wait.
 *
 * KEYS[1] bucket hash; ARGV: capacity, window in ms, now in ms. Returns {allowed, retryAfterSeconds}.
 * The caller's clock is passed in so that all instances and the tests agree on one notion of time.
 */
export const TOKEN_BUCKET_SCRIPT = `
local capacity = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local nowMs = tonumber(ARGV[3])
local stored = redis.call('HMGET', KEYS[1], 't', 'u')
local tokens = tonumber(stored[1])
local updated = tonumber(stored[2])
if tokens == nil or updated == nil then
  tokens = capacity
  updated = nowMs
end
local elapsed = math.max(0, nowMs - updated)
tokens = math.min(capacity, tokens + elapsed * capacity / windowMs)
local allowed = 0
local retry = 0
if tokens + 1e-9 >= 1 then
  tokens = tokens - 1
  allowed = 1
else
  local waitMs = math.floor((1 - tokens) * windowMs / capacity + 0.5)
  retry = math.max(1, math.ceil(waitMs / 1000))
end
redis.call('HSET', KEYS[1], 't', tostring(tokens), 'u', tostring(math.max(nowMs, updated)))
redis.call('PEXPIRE', KEYS[1], windowMs)
return {allowed, retry}
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
