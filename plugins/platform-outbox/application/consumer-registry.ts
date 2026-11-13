import { OUTBOX_CONSUMER_NAME_FORMAT, OUTBOX_CONSUMER_NAME_MAX_LENGTH } from '../domain/constants';
import { OutboxConsumerInvalidError, OutboxConsumerUnknownError, OutboxRegistryClosedError } from '../domain/errors';
import type { OutboxConsumer, OutboxDeliveryJobData } from '../domain/outbox-event';
import type { JobAttemptInfo, OutboxQueuesPort } from './ports';

/** What runs a delivery job; the {@link DeliveryRunner} binds itself here. */
export type DeliveryDispatch = (data: OutboxDeliveryJobData, job: JobAttemptInfo) => Promise<void>;

/**
 * The consumers of this process (D105). Plugins register in `onModuleInit`; the registry closes at bootstrap. The first
 * consumer of a queue creates the queue, whose one processor dispatches on the job's `consumer`.
 */
export class OutboxConsumerRegistry {
  private readonly consumers = new Map<string, OutboxConsumer>();
  private readonly queues = new Set<string>();
  private dispatch: DeliveryDispatch | undefined;
  private closed = false;

  constructor(private readonly queuePort: OutboxQueuesPort) {}

  /**
   * @throws OutboxRegistryClosedError after bootstrap and OutboxConsumerInvalidError for a bad or repeated name or a
   * consumer without topics.
   */
  register(consumer: OutboxConsumer): void {
    if (this.closed) throw new OutboxRegistryClosedError(consumer.name);
    this.validate(consumer);
    this.consumers.set(consumer.name, consumer);
    if (this.queues.has(consumer.queue)) return;
    this.queues.add(consumer.queue);
    this.queuePort.defineDeliveryQueue(consumer.queue, (data, job) => this.run(data, job));
  }

  /** Called by the plugin at bootstrap: every `onModuleInit` has run, so no further consumer is accepted. */
  close(): void {
    this.closed = true;
  }

  /** The consumers whose topics include `topic`, in registration order. */
  forTopic(topic: string): OutboxConsumer[] {
    return [...this.consumers.values()].filter((consumer) => (consumer.topics as readonly string[]).includes(topic));
  }

  /** @throws OutboxConsumerUnknownError for a name no consumer of this process has. */
  get(name: string): OutboxConsumer {
    const consumer = this.consumers.get(name);
    if (consumer === undefined) throw new OutboxConsumerUnknownError(name);
    return consumer;
  }

  /** Lets the delivery runner take the jobs of every consumer queue. */
  bindDispatch(dispatch: DeliveryDispatch): void {
    this.dispatch = dispatch;
  }

  private run(data: OutboxDeliveryJobData, job: JobAttemptInfo): Promise<void> {
    if (this.dispatch === undefined) return Promise.reject(new Error('The outbox delivery runner is not bound'));
    return this.dispatch(data, job);
  }

  private validate(consumer: OutboxConsumer): void {
    const { name } = consumer;
    if (name.length > OUTBOX_CONSUMER_NAME_MAX_LENGTH || !OUTBOX_CONSUMER_NAME_FORMAT.test(name)) {
      throw new OutboxConsumerInvalidError(name, 'the name must be kebab-case, at most 40 characters');
    }
    if (this.consumers.has(name)) throw new OutboxConsumerInvalidError(name, 'the name is already registered');
    if (consumer.topics.length === 0) throw new OutboxConsumerInvalidError(name, 'it listens to no topic');
  }
}
