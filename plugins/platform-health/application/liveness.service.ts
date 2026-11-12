import type { HealthProbeResponse } from '@cod/shared';
import { LIVENESS_MAX_EVENT_LOOP_LAG_MS } from '../domain/constants';

/** The `/livez` body: one check, the event-loop lag, whose `durationMs` is the lag. */
export type LivenessReport = HealthProbeResponse<'eventLoop'>;

/** Answers `/livez`: is this process still able to run its event loop? It checks no dependency. */
export class LivenessService {
  /** @param lagSampler returns the worst event-loop lag, in milliseconds, of the recent window; reading it must not change it. */
  constructor(private readonly lagSampler: () => number) {}

  /** Fails when the event-loop lag exceeds {@link LIVENESS_MAX_EVENT_LOOP_LAG_MS}. */
  check(): LivenessReport {
    const lagMs = Math.round(this.lagSampler());
    if (lagMs > LIVENESS_MAX_EVENT_LOOP_LAG_MS) {
      const error = `event-loop lag ${String(lagMs)} ms exceeds ${String(LIVENESS_MAX_EVENT_LOOP_LAG_MS)} ms`;
      return { status: 'not_ready', checks: { eventLoop: { ok: false, durationMs: lagMs, error } } };
    }
    return { status: 'ready', checks: { eventLoop: { ok: true, durationMs: lagMs } } };
  }
}
