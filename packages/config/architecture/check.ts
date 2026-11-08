import { join } from 'node:path';
import type { ICruiseResult, IViolation } from 'dependency-cruiser' with { 'resolution-mode': 'import' };
import { ARCHITECTURE_RULES } from './rules';

/** A dependency that breaks one of the {@link ARCHITECTURE_RULES}. */
export interface ArchitectureViolation {
  rule: string;
  from: string;
  to: string;
}

/** Outcome of an architecture check: the violations and every module that was cruised. */
export interface ArchitectureReport {
  violations: ArchitectureViolation[];
  cruisedModules: string[];
}

/** tsconfig whose compiler options drive the TypeScript pre-compilation dependency scan. */
const TS_CONFIG_FILE = join(__dirname, '../tsconfig.base.json');
// .next/ holds the storefront's generated build output, not sources.
const EXCLUDED_PATHS = 'node_modules|dist|\\.next/|\\.test\\.ts$';

const toViolation = (violation: IViolation): ArchitectureViolation => ({
  rule: violation.rule.name,
  from: violation.from,
  to: violation.to,
});

/**
 * Cruises `roots` (relative to `baseDir`) and reports every dependency that breaks the
 * {@link ARCHITECTURE_RULES}. Type-only imports count (`tsPreCompilationDeps`).
 *
 * @throws when the cruise itself fails, e.g. a root does not exist, so a broken check never reads as a pass.
 */
export async function checkArchitecture(options: {
  baseDir: string;
  roots: readonly string[];
}): Promise<ArchitectureReport> {
  const { cruise } = await import('dependency-cruiser');
  const { default: extractTSConfig } = await import('dependency-cruiser/config-utl/extract-ts-config');
  const { output } = await cruise(
    [...options.roots],
    {
      validate: true,
      baseDir: options.baseDir,
      ruleSet: { forbidden: ARCHITECTURE_RULES },
      tsPreCompilationDeps: true,
      tsConfig: { fileName: TS_CONFIG_FILE },
      exclude: { path: EXCLUDED_PATHS },
      doNotFollow: { path: 'node_modules' },
    },
    {},
    { tsConfig: extractTSConfig(TS_CONFIG_FILE) },
  );
  return toReport(output);
}

function toReport(output: ICruiseResult | string): ArchitectureReport {
  if (typeof output === 'string') {
    throw new Error(`dependency-cruiser returned a report instead of a cruise result: ${output}`);
  }
  return {
    violations: output.summary.violations.map(toViolation),
    cruisedModules: output.modules.map((module) => module.source),
  };
}
