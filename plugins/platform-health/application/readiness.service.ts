import { DomainError, type HealthCheckResult } from '@cod/shared';
import { LOGGER_CONTEXT, PROBE_FAILED_CODE, PROBE_FAILURE_LOG_INTERVAL_MS, type ProbeName } from '../domain/constants';
import type { ErrorLogger } from '../domain/ports';
import { evaluateReadiness, type ProbeOutcome, type ReadinessProbe, type ReadinessReport } from '../domain/readiness';
import { withTimeout } from '../domain/with-timeout';

const elapsedSince = (startedAt: number): number => Math.round(performance.now() - startedAt);

const describeFailure = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * What the anonymous `/readyz` body may say: a fixed code. Our domain errors name their own; anything else is
 * driver text (it can hold a host, a port, a user), so it gets a generic code and stays in the log.
 */
const publicReason = (error: unknown): string => (error instanceof DomainError ? error.code : PROBE_FAILED_CODE);

/** Answers `/readyz`: is every dependency of this process usable right now? */
export class ReadinessService {
  private readonly lastLoggedAt = new Map<ProbeName, number>();

  constructor(
    private readonly probes: readonly ReadinessProbe[],
    private readonly logger: ErrorLogger,
  ) {}

  /** Runs every probe in parallel, each within its own budget, and reports them all. Never rejects. */
  async check(): Promise<ReadinessReport> {
    const outcomes = await Promise.all(this.probes.map((probe) => this.run(probe)));
    return evaluateReadiness(outcomes);
  }

  private async run(probe: ReadinessProbe): Promise<ProbeOutcome> {
    const startedAt = performance.now();
    let result: HealthCheckResult;
    try {
      await withTimeout((signal) => probe.check(signal), probe.timeoutMs);
      result = { ok: true, durationMs: elapsedSince(startedAt) };
    } catch (error) {
      this.logFailure(probe.name, error);
      result = { ok: false, durationMs: elapsedSince(startedAt), error: publicReason(error) };
    }
    return { name: probe.name, result };
  }

  /** The full error goes to the log, at most once per probe per {@link PROBE_FAILURE_LOG_INTERVAL_MS}. */
  private logFailure(name: ProbeName, error: unknown): void {
    const now = Date.now();
    if (now - (this.lastLoggedAt.get(name) ?? Number.NEGATIVE_INFINITY) < PROBE_FAILURE_LOG_INTERVAL_MS) {
      return;
    }
    this.lastLoggedAt.set(name, now);
    this.logger.error(`Readiness probe "${name}" failed: ${describeFailure(error)}`, LOGGER_CONTEXT);
  }
}
