import { DomainError, type HealthCheckResult } from '@cod/shared';
import { LOGGER_CONTEXT, PROBE_FAILED_REASON } from '../domain/constants';
import type { ErrorLogger } from '../domain/ports';
import { evaluateReadiness, type ProbeOutcome, type ReadinessProbe, type ReadinessReport } from '../domain/readiness';
import { withTimeout } from '../domain/with-timeout';

const elapsedSince = (startedAt: number): number => Math.round(performance.now() - startedAt);

const describeFailure = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * What the anonymous `/readyz` body may say: our own domain errors carry fixed, safe messages; anything else
 * is driver text (it can hold a host, a port, a user) and stays in the log.
 */
const publicReason = (error: unknown): string => (error instanceof DomainError ? error.message : PROBE_FAILED_REASON);

/** Answers `/readyz`: is every dependency of this process usable right now? */
export class ReadinessService {
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
      this.logger.error(`Readiness probe "${probe.name}" failed: ${describeFailure(error)}`, LOGGER_CONTEXT);
      result = { ok: false, durationMs: elapsedSince(startedAt), error: publicReason(error) };
    }
    return { name: probe.name, result };
  }
}
