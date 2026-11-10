import { CONTINUATION_SUFFIX } from './constants';

/**
 * The id of the continuation of job `jobId`: `ob-1` gives `ob-1-r1`, `ob-1-r2` gives `ob-1-r3`. A durable id whose
 * own last part looks like `r{n}` is read as a continuation, which only shifts its count.
 */
export function continuationJobId(jobId: string): string {
  const { base, count } = CONTINUATION_SUFFIX.exec(jobId)?.groups ?? {};
  if (base === undefined || count === undefined) return `${jobId}-r1`;
  return `${base}-r${String(Number(count) + 1)}`;
}
