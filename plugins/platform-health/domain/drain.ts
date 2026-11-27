import { JOB_DRAIN_TIMEOUT_MS, REQUEST_DRAIN_TIMEOUT_MS, SHUTDOWN_CLOSE_MARGIN_MS } from './constants';

/** The processes that run the health plugin; `migrate` has no drain: a migration is never cut short. */
export type DrainRole = 'api' | 'worker' | 'migrate';

/** How one role drains (ADR 0013). */
export interface DrainPlan {
  /** How long the shutdown waits for in-flight HTTP requests; 0 when the role serves none worth waiting for. */
  readonly requestDrainMs: number;
  /** When the process ends itself if the shutdown has not finished; null for no deadline. */
  readonly deadlineMs: number | null;
}

/**
 * The drain plan of `role`. The worker's job drain is Vendure's own graceful queue stop, which waits for the
 * active jobs; the deadline bounds it to {@link JOB_DRAIN_TIMEOUT_MS}.
 */
export function drainPlanFor(role: DrainRole): DrainPlan {
  switch (role) {
    case 'api':
      return {
        requestDrainMs: REQUEST_DRAIN_TIMEOUT_MS,
        deadlineMs: REQUEST_DRAIN_TIMEOUT_MS + SHUTDOWN_CLOSE_MARGIN_MS,
      };
    case 'worker':
      return { requestDrainMs: 0, deadlineMs: JOB_DRAIN_TIMEOUT_MS + SHUTDOWN_CLOSE_MARGIN_MS };
    case 'migrate':
      return { requestDrainMs: 0, deadlineMs: null };
  }
}
