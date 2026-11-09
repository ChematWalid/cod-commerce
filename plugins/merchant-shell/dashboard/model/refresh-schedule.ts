/** Each wait is this many times the one before. */
const BACKOFF_FACTOR = 2;

/**
 * When to refresh, in ms from the start, while waiting for something that usually arrives at once but can lag: the
 * first after `firstDelayMs`, each next wait doubled (1, 2, 4 s), all before `timeoutMs`.
 */
export function backoffRefreshTimes(firstDelayMs: number, timeoutMs: number): number[] {
  const times: number[] = [];
  if (firstDelayMs <= 0) return times;
  for (let delay = firstDelayMs, at = delay; at < timeoutMs; delay *= BACKOFF_FACTOR, at += delay) times.push(at);
  return times;
}
