import type { InspectableJobQueueStrategy } from '@vendure/core';

/** The Admin API's job list options, as the strategy receives them. */
export type JobListOptions = NonNullable<Parameters<InspectableJobQueueStrategy['findMany']>[0]>;
type JobFilter = NonNullable<JobListOptions['filter']>;

/** Every filter in a tree of `_and`/`_or` lists; the dashboard wraps its column filters in `_and`. */
function flatten(filter: JobFilter): JobFilter[] {
  const nested = [...(filter._and ?? []), ...(filter._or ?? [])];
  return [filter, ...nested.flatMap(flatten)];
}

/**
 * The queue names a job list is filtered on (`queueName.eq` or `queueName.in`, wherever it sits in the
 * filter tree, as the stock strategy reads it), or undefined when it is not filtered by queue.
 */
export function queueNamesOf(options: JobListOptions | undefined): readonly string[] | undefined {
  if (options?.filter == null) return undefined;
  const operators = flatten(options.filter).flatMap((filter) => (filter.queueName == null ? [] : [filter.queueName]));
  if (operators.length === 0) return undefined;
  const names = operators.flatMap((operator) => [
    ...(operator.eq == null ? [] : [operator.eq]),
    ...(operator.in ?? []),
  ]);
  return names.length === 0 ? undefined : names;
}
