/**
 * The api port of each e2e file. Files run one at a time, but a distinct port per file means a server left
 * behind by a crashed file never answers for the next one.
 */
export const E2E_PORTS = {
  smoke: 3051,
  readyz: 3052,
  redisDown: 3053,
  activeQueues: 3054,
  /** The health server of the worker that `worker-health.e2e.test.ts` boots with `bootstrapWorker`. */
  workerHealth: 3055,
  /** A worker never listens on its api port; Vendure's config still needs one. */
  workerApiUnused: 3056,
  bearerClient: 3057,
  authEmail: 3058,
  authEmailRetry: 3059,
  workerPools: 3060,
  platformQueues: 3061,
  internalOnly: 3062,
  valkeyLoss: 3063,
  isolation: 3064,
  p2Isolation: 3065,
} as const;
