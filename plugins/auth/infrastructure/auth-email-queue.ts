import { Injectable, type OnModuleInit } from '@nestjs/common';
import { EventBus, JobQueueService, Logger, RequestContext, VendureEvent } from '@vendure/core';
import { AuthEmailDelivery } from '../application/auth-email-delivery';
import { PasswordResetService } from '../application/password-reset.service';
import { AUTH_EMAIL_ATTEMPTS, AUTH_EMAIL_QUEUE } from '../domain/constants';
import { type AuthEmailKind, AuthEmailDeliveryError } from '../domain/email';
import type { AuthEmailQueuePort, PasswordResetQueuePort } from '../domain/ports/auth-email-queue.port';
import type { OperationContext } from '../domain/ports/operation-context';

const LOG_CONTEXT = 'AuthEmailQueue';
const RESET_REQUEST_LABEL = 'password-reset-request';

/** What the queue stores: the sealed request and, for a forgot-password request, a mark saying it is one. */
interface AuthEmailJobData {
  readonly sealed: string;
  readonly resetRequest?: true;
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

/** Published for a forgot-password request; {@link AuthEmailJobs} queues it for the worker to look the email up. */
export class PasswordResetRequestedEvent extends VendureEvent {
  constructor(
    readonly ctx: RequestContext,
    readonly sealed: string,
  ) {
    super();
  }
}

/** The service's queue port: it only announces the request; {@link AuthEmailJobs} queues it after commit. */
@Injectable()
export class EventBusAuthEmailQueue implements AuthEmailQueuePort, PasswordResetQueuePort {
  constructor(private readonly eventBus: EventBus) {}

  async enqueue(ctx: OperationContext, sealed: string, kind: AuthEmailKind): Promise<void> {
    // The one place the opaque context becomes Vendure's: the event bus reads its transaction from it.
    await this.eventBus.publish(new AuthEmailRequestedEvent(ctx as unknown as RequestContext, sealed, kind));
  }

  async enqueueResetRequest(ctx: OperationContext, sealed: string): Promise<void> {
    await this.eventBus.publish(new PasswordResetRequestedEvent(ctx as unknown as RequestContext, sealed));
  }
}

/**
 * The `auth-email` job queue. Every process creates it; a worker of the `critical` pool (or `all`) consumes it
 * (D42, D97). On BullMQ the queue registry sets the attempts and backoff (D98); the per-call `retries` below
 * stays because the in-memory strategy of the plugin tests honours only that.
 */
@Injectable()
export class AuthEmailJobs implements OnModuleInit {
  private queue: Awaited<ReturnType<JobQueueService['createQueue']>> | undefined;

  constructor(
    private readonly jobQueues: JobQueueService,
    private readonly eventBus: EventBus,
    private readonly delivery: AuthEmailDelivery,
    private readonly resets: PasswordResetService,
  ) {}

  async onModuleInit(): Promise<void> {
    const queue = await this.jobQueues.createQueue<AuthEmailJobData>({
      name: AUTH_EMAIL_QUEUE,
      process: (job) =>
        job.data.resetRequest === true ? this.fulfilReset(job.data.sealed) : this.process(job.data.sealed),
    });
    this.queue = queue;
    this.eventBus.ofType(AuthEmailRequestedEvent).subscribe((event) => {
      void this.add({ sealed: event.sealed }, event.kind);
    });
    this.eventBus.ofType(PasswordResetRequestedEvent).subscribe((event) => {
      void this.add({ sealed: event.sealed, resetRequest: true }, RESET_REQUEST_LABEL);
    });
  }

  private async fulfilReset(sealed: string): Promise<void> {
    try {
      await this.resets.fulfil(RequestContext.empty() as unknown as OperationContext, sealed);
    } catch (error) {
      Logger.error(`Password reset request failed: reason=${(error as Error).name}`, LOG_CONTEXT);
      throw error;
    }
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

  private async add(data: AuthEmailJobData, kind: string): Promise<void> {
    try {
      if (this.queue === undefined) {
        throw new Error('the auth-email queue is not created yet');
      }
      await this.queue.add({ ...data }, { retries: AUTH_EMAIL_ATTEMPTS - 1 });
    } catch (error) {
      // The request is already committed and cannot be handed back to the caller: say so loudly.
      Logger.error(`Auth email could not be queued: kind=${kind} reason=${(error as Error).name}`, LOG_CONTEXT);
    }
  }
}
