import { Injectable, type OnModuleInit } from '@nestjs/common';
import { EventBus, JobQueueService, Logger, type RequestContext, VendureEvent } from '@vendure/core';
import { AuthEmailDelivery } from '../application/auth-email-delivery';
import { AUTH_EMAIL_ATTEMPTS, AUTH_EMAIL_QUEUE } from '../domain/constants';
import { type AuthEmailKind, AuthEmailDeliveryError } from '../domain/email';
import type { AuthEmailQueuePort } from '../domain/ports/auth-email-queue.port';
import type { OperationContext } from '../domain/ports/operation-context';

const LOG_CONTEXT = 'AuthEmailQueue';

/** What the queue stores: the sealed request and nothing else. */
interface AuthEmailJobData {
  readonly sealed: string;
}

/**
 * Published by {@link EventBusAuthEmailQueue}. Vendure's event bus holds an event with a context until that
 * context's transaction ends and drops it on rollback: that is what makes queueing happen after commit.
 */
export class AuthEmailRequestedEvent extends VendureEvent {
  constructor(
    readonly ctx: RequestContext,
    readonly sealed: string,
    readonly kind: AuthEmailKind,
  ) {
    super();
  }
}

/** The service's queue port: it only announces the request; {@link AuthEmailJobs} queues it after commit. */
@Injectable()
export class EventBusAuthEmailQueue implements AuthEmailQueuePort {
  constructor(private readonly eventBus: EventBus) {}

  async enqueue(ctx: OperationContext, sealed: string, kind: AuthEmailKind): Promise<void> {
    // The one place the opaque context becomes Vendure's: the event bus reads its transaction from it.
    await this.eventBus.publish(new AuthEmailRequestedEvent(ctx as unknown as RequestContext, sealed, kind));
  }
}

/**
 * The `auth-email` job queue. Every process creates it; only a process that runs the job queue consumes it, and
 * with `activeQueues` unset that is every worker (D42). Failures retry up to {@link AUTH_EMAIL_ATTEMPTS} attempts;
 * the backoff comes from the BullMQ options of the server.
 */
@Injectable()
export class AuthEmailJobs implements OnModuleInit {
  private queue: Awaited<ReturnType<JobQueueService['createQueue']>> | undefined;

  constructor(
    private readonly jobQueues: JobQueueService,
    private readonly eventBus: EventBus,
    private readonly delivery: AuthEmailDelivery,
  ) {}

  async onModuleInit(): Promise<void> {
    const queue = await this.jobQueues.createQueue<AuthEmailJobData>({
      name: AUTH_EMAIL_QUEUE,
      process: (job) => this.process(job.data.sealed),
    });
    this.queue = queue;
    this.eventBus.ofType(AuthEmailRequestedEvent).subscribe((event) => {
      void this.add(event.sealed, event.kind);
    });
  }

  private async process(sealed: string): Promise<void> {
    try {
      await this.delivery.deliver(sealed);
    } catch (error) {
      if (error instanceof AuthEmailDeliveryError) {
        Logger.error(
          `Auth email not sent: kind=${error.kind} recipient=${error.recipientHash ?? 'unknown'} reason=${error.reason}`,
          LOG_CONTEXT,
        );
      }
      throw error;
    }
  }

  private async add(sealed: string, kind: AuthEmailKind): Promise<void> {
    try {
      if (this.queue === undefined) {
        throw new Error('the auth-email queue is not created yet');
      }
      await this.queue.add({ sealed }, { retries: AUTH_EMAIL_ATTEMPTS - 1 });
    } catch (error) {
      // The request is already committed and cannot be handed back to the caller: say so loudly.
      Logger.error(`Auth email could not be queued: kind=${kind} reason=${(error as Error).name}`, LOG_CONTEXT);
    }
  }
}
