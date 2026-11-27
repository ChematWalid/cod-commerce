import { DomainError, type HealthCheckResult } from '@cod/shared';
import {
  DRAINING_CODE,
  LOGGER_CONTEXT,
  PROBE_FAILED_CODE,
  PROBE_FAILURE_LOG_INTERVAL_MS,
  type ProbeName,
} from '../domain/constants';
import type { DrainSignal, ErrorLogger } from '../domain/ports';
import { evaluateReadiness, type ProbeOutcome, type ReadinessProbe, type ReadinessReport } from '../domain/readiness';
import { withTimeout } from '../domain/with-timeout';

const elapsedSince = (startedAt: number): number => Math.round(performance.now() - startedAt);

const describeFailure = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * What the anonymous `/readyz` body may say: a fixed code. Our domain errors name their own; anything else is
 * driver text (it can hold a host, a port, a user), so it gets a generic code and stays in the log.
 */
const publicReason = (error: unknown): string => (error instanceof DomainError ? error.code : PROBE_FAILED_CODE);

const NOT_DRAINING: DrainSignal = { isDraining: false };

/** How {@link ReadinessService} answers beyond its probes. */
export interface ReadinessOptions {
  /** While it says draining, every check fails with {@link DRAINING_CODE} and no probe runs. */
  readonly drain?: DrainSignal;
  /** How long a probe round's report is reused; 0 (the default) probes on every call. */
  readonly cacheTtlMs?: number;
}

interface CachedReport {
  readonly report: Promise<ReadinessReport>;
  readonly at: number;
}

/** The report of a draining process: every check fails with {@link DRAINING_CODE}. */
const drainingReport = (probes: readonly ReadinessProbe[]): ReadinessReport =>
  evaluateReadiness(probes.map(({ name }) => ({ name, result: { ok: false, durationMs: 0, error: DRAINING_CODE } })));

/** Answers `/readyz`: is every dependency of this process usable right now? */
export class ReadinessService {
  private readonly lastLoggedAt = new Map<ProbeName, number>();
  private cached: CachedReport | undefined;

  constructor(
    private readonly probes: readonly ReadinessProbe[],
    private readonly logger: ErrorLogger,
    private readonly options: ReadinessOptions = {},
  ) {}

  /**
   * Runs every probe in parallel, each within its own budget, and reports them all. Never rejects. Callers within
   * the cache window share one probe round (concurrent ones included); a draining process answers without probing.
   */
  check(): Promise<ReadinessReport> {
    if ((this.options.drain ?? NOT_DRAINING).isDraining) {
      return Promise.resolve(drainingReport(this.probes));
    }
    const ttlMs = this.options.cacheTtlMs ?? 0;
    const now = Date.now();
    if (this.cached !== undefined && now - this.cached.at < ttlMs) {
      return this.cached.report;
    }
    const report = this.probeAll();
    this.cached = ttlMs > 0 ? { report, at: now } : undefined;
    return report;
  }

  private async probeAll(): Promise<ReadinessReport> {
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
