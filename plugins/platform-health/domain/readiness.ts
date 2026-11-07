import type { HealthCheckResult, HealthProbeResponse } from '@cod/shared';
import type { ProbeName } from './constants';

/** The `/readyz` body: one check per {@link ProbeName}. */
export type ReadinessReport = HealthProbeResponse<ProbeName>;

/** A dependency the process needs before it can take traffic or jobs. */
export interface ReadinessProbe {
  readonly name: ProbeName;
  /** The budget {@link ReadinessProbe.check} gets before it counts as failed. */
  readonly timeoutMs: number;
  /** Resolves when the dependency is usable; rejects with the reason otherwise. */
  check(): Promise<void>;
}

/** The result of running one probe. */
export interface ProbeOutcome {
  readonly name: ProbeName;
  readonly result: HealthCheckResult;
}

/** A probe nobody registered fails, so a wiring mistake can never report ready. */
const NOT_REGISTERED: HealthCheckResult = { ok: false, durationMs: 0, error: 'probe not registered' };

const resultOf = (outcomes: readonly ProbeOutcome[], name: ProbeName): HealthCheckResult =>
  outcomes.find((outcome) => outcome.name === name)?.result ?? NOT_REGISTERED;

/**
 * Folds probe outcomes into the readiness report: ready only when every probe passed.
 *
 * @param outcomes one outcome per probe that ran; a probe without an outcome counts as failed.
 */
export function evaluateReadiness(outcomes: readonly ProbeOutcome[]): ReadinessReport {
  const checks: ReadinessReport['checks'] = {
    postgres: resultOf(outcomes, 'postgres'),
    redis: resultOf(outcomes, 'redis'),
    migrations: resultOf(outcomes, 'migrations'),
  };
  const ready = Object.values(checks).every((check) => check.ok);
  return { status: ready ? 'ready' : 'not_ready', checks };
}
