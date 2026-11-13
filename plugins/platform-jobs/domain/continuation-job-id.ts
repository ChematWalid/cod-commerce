import { CONTINUATION_STEP, CONTINUATION_SUFFIX } from './constants';

/**
 * The id of the continuation of job `jobId`: `ob-1` gives `ob-1-r1`, `ob-1-r2` gives `ob-1-r3`. `durableJobId` refuses ids
 * that end like a continuation, so an id that does is always one.
 */
export function continuationJobId(jobId: string): string {
  const { base, count } = CONTINUATION_SUFFIX.exec(jobId)?.groups ?? {};
  if (base === undefined || count === undefined) return `${jobId}-r1`;
  return `${base}-r${(BigInt(count) + BigInt(CONTINUATION_STEP)).toString()}`;
}
