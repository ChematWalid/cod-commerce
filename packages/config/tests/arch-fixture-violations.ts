import type { ArchitectureViolation } from '../architecture/check';

const BAD = 'plugins/bad';
const TENANCY_ENTRY = 'plugins/tenancy/index.ts';
const RATE_LIMIT_ENTRY = 'plugins/rate-limit/index.ts';
const PROVISIONING_ENTRY = 'plugins/tenancy/provisioning.ts';
const SHELL_API = 'plugins/merchant-shell/dashboard/shell-api.ts';
const ADAPTER = `${BAD}/infrastructure/adapter.ts`;
const OWN_ENTRY = `${BAD}/index.ts`;

const violation = (rule: string, from: string, to: string): ArchitectureViolation => ({
  rule,
  from: `${BAD}/${from}`,
  to,
});

/**
 * Every violation the `bad` fixture plugin must produce, and nothing else. Each relative-path shape has a
 * package-name twin (`*-package.ts`), the import form the real plugins use.
 */
export const BAD_FIXTURE_VIOLATIONS: readonly ArchitectureViolation[] = [
  violation('application-is-pure', 'application/uses-typeorm.ts', 'typeorm'),
  violation('application-is-pure', 'application/uses-vendure-type.ts', '@vendure/core'),
  violation('application-no-concretes', 'application/district-pricing.service.ts', ADAPTER),
  violation('application-no-concretes', 'application/uses-infrastructure.ts', ADAPTER),
  violation('dashboard-no-plugin-core', 'dashboard/uses-domain.ts', `${BAD}/domain/clean.ts`),
  violation('dashboard-no-server-entry', 'dashboard/uses-rate-limit-package.ts', RATE_LIMIT_ENTRY),
  violation('dashboard-no-server-entry', 'dashboard/uses-tenancy-entry.ts', TENANCY_ENTRY),
  violation('dashboard-no-server-entry', 'dashboard/uses-tenancy-package.ts', TENANCY_ENTRY),
  violation('domain-is-pure', 'domain/uses-vendure.ts', '@vendure/core'),
  violation('domain-no-outer-layers', 'domain/uses-application.ts', `${BAD}/application/create.service.ts`),
  violation('layers-no-own-entry', 'application/uses-own-package.ts', OWN_ENTRY),
  violation('layers-no-own-entry', 'domain/uses-own-package.ts', OWN_ENTRY),
  violation('no-cross-plugin-internals', 'api/uses-other-plugin.ts', 'plugins/other/domain/secret.ts'),
  violation('no-cross-plugin-internals', 'api/uses-shell-api-package.ts', SHELL_API),
  violation('no-cross-plugin-internals', 'api/uses-shell-api.ts', SHELL_API),
  violation(
    'no-cross-plugin-internals',
    'dashboard/uses-shell-internals.ts',
    'plugins/merchant-shell/dashboard/internal.ts',
  ),
  violation('no-unresolved-workspace-import', 'application/uses-unresolved-package.ts', '@cod/plugin-missing'),
  violation('plugin-core-no-tenancy-entry', 'application/uses-rate-limit-entry.ts', RATE_LIMIT_ENTRY),
  violation('plugin-core-no-tenancy-entry', 'application/uses-tenancy-entry.ts', TENANCY_ENTRY),
  violation('plugin-core-no-tenancy-entry', 'application/uses-tenancy-package.ts', TENANCY_ENTRY),
  violation('tenancy-provisioning-entry-restricted', 'infrastructure/uses-provisioning-entry.ts', PROVISIONING_ENTRY),
  violation('tenancy-provisioning-entry-restricted', 'infrastructure/uses-provisioning-package.ts', PROVISIONING_ENTRY),
];

/** `rule | from -> to`, sorted, so a failed comparison names the missing or extra violation. */
export const describeViolations = (violations: readonly ArchitectureViolation[]): string[] =>
  violations.map((entry) => `${entry.rule} | ${entry.from} -> ${entry.to}`).sort();
