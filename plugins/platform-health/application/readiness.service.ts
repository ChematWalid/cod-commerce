import type { HealthCheckResult } from '@cod/shared';
import { evaluateReadiness, type ProbeOutcome, type ReadinessProbe, type ReadinessReport } from '../domain/readiness';
import { withTimeout } from '../domain/with-timeout';

const elapsedSince = (startedAt: number): number => Math.round(performance.now() - startedAt);

const describeFailure = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Answers `/readyz`: is every dependency of this process usable right now? */
export class ReadinessService {
  constructor(private readonly probes: readonly ReadinessProbe[]) {}

  /** Runs every probe in parallel, each within its own budget, and reports them all. Never rejects. */
  async check(): Promise<ReadinessReport> {
    const outcomes = await Promise.all(this.probes.map((probe) => this.run(probe)));
    return evaluateReadiness(outcomes);
  }

  private async run(probe: ReadinessProbe): Promise<ProbeOutcome> {
    const startedAt = performance.now();
    let result: HealthCheckResult;
    try {
      await withTimeout(probe.check(), probe.timeoutMs);
      result = { ok: true, durationMs: elapsedSince(startedAt) };
    } catch (error) {
      // Not swallowed: the reason is reported in the probe body that the orchestrator and operators read.
      result = { ok: false, durationMs: elapsedSince(startedAt), error: describeFailure(error) };
    }
    return { name: probe.name, result };
  }
}
