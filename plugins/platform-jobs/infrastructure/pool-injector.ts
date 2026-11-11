import type { Type } from '@nestjs/common';
import { Injector, ProcessContext } from '@vendure/core';
import type { BullMQPluginOptions } from '@vendure/job-queue-plugin/package/bullmq';
// D100: deep imports into the job-queue plugin (it has no `exports` map). The stock strategy reads its options
// and its job list index through the injector, under these two tokens.
import { BULLMQ_PLUGIN_OPTIONS } from '@vendure/job-queue-plugin/package/bullmq/constants';
import { JobListIndexService } from '@vendure/job-queue-plugin/package/bullmq/job-list-index.service';

type Token = Type<unknown> | string | symbol;

/**
 * The injector one pool's stock `BullMQJobQueueStrategy` is initialised with: it answers that pool's options
 * and a job list index of its own (the plugin's singleton index keeps one queue and one prefix), and passes
 * every other token to the app's injector (D100).
 */
export class PoolInjector extends Injector {
  /** The job list index of this pool; the pooled index-cleaning task runs it. */
  readonly jobListIndex: JobListIndexService;
  private readonly overrides: ReadonlyMap<Token, unknown>;

  constructor(
    private readonly parent: Injector,
    options: BullMQPluginOptions,
  ) {
    // Never used: `get` and `resolve` go to the parent, which holds the app's module reference.
    super(undefined as never);
    this.jobListIndex = new JobListIndexService(options, parent.get(ProcessContext));
    this.overrides = new Map<Token, unknown>([
      [BULLMQ_PLUGIN_OPTIONS, options],
      [JobListIndexService, this.jobListIndex],
    ]);
  }

  // The signature is Injector's, which this class overrides.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  override get<T, R = T>(typeOrToken: Type<T> | string | symbol): R {
    return this.overrides.has(typeOrToken)
      ? (this.overrides.get(typeOrToken) as R)
      : this.parent.get<T, R>(typeOrToken);
  }

  override resolve<T, R = T>(typeOrToken: Type<T> | string | symbol): Promise<R> {
    return this.overrides.has(typeOrToken)
      ? Promise.resolve(this.overrides.get(typeOrToken) as R)
      : this.parent.resolve<T, R>(typeOrToken);
  }
}
