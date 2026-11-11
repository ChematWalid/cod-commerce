import type { ArchitectureViolation } from '../architecture/check';

const BAD = 'plugins/bad';
const TENANCY_ENTRY = 'plugins/tenancy/index.ts';
const RATE_LIMIT_ENTRY = 'plugins/rate-limit/index.ts';
const PROVISIONING_ENTRY = 'plugins/tenancy/provisioning.ts';
const SHELL_API = 'plugins/merchant-shell/dashboard/shell-api.ts';
const ADAPTER = `${BAD}/infrastructure/adapter.ts`;
const OWN_ENTRY = `${BAD}/index.ts`;
/** Code parked where the permission and data access gates do not scan: production code must not import it. */
const HIDDEN_IN_TESTS = `${BAD}/tests/unit/hidden.resolver.ts`;
const HIDDEN_IN_DASHBOARD = `${BAD}/dashboard/routes/hidden.resolver.ts`;
/** A framework module that resolves, as in the workspace; `@vendure/core` stays unresolved in the fixtures. */
const TYPEORM = 'node_modules/typeorm/index.js';

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
  violation('application-is-pure', 'application/uses-typeorm.ts', TYPEORM),
  violation('application-is-pure', 'application/uses-vendure-type.ts', '@vendure/core'),
  violation('application-no-concretes', 'application/district-pricing.service.ts', ADAPTER),
  violation('application-no-concretes', 'application/uses-infrastructure.ts', ADAPTER),
  violation('dashboard-no-plugin-core', 'dashboard/uses-domain.ts', `${BAD}/domain/clean.ts`),
  violation('dashboard-no-server-entry', 'dashboard/uses-rate-limit-package.ts', RATE_LIMIT_ENTRY),
  violation('dashboard-no-server-entry', 'dashboard/uses-tenancy-entry.ts', TENANCY_ENTRY),
  violation('dashboard-no-server-entry', 'dashboard/uses-tenancy-package.ts', TENANCY_ENTRY),
  violation('dashboard-shared-is-pure', 'dashboard/constants.ts', '@vendure/core'),
  violation('dashboard-shared-is-pure', 'dashboard/constants.ts', HIDDEN_IN_DASHBOARD),
  violation('domain-is-pure', 'domain/uses-typeorm.ts', TYPEORM),
  violation('domain-is-pure', 'domain/uses-vendure.ts', '@vendure/core'),
  violation('domain-no-outer-layers', 'domain/uses-application.ts', `${BAD}/application/create.service.ts`),
  violation('layers-no-dashboard', 'api/uses-dashboard-constants.ts', `${BAD}/dashboard/constants.ts`),
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
  violation('plugin-root-no-dashboard', 'dashboard-leak.plugin.ts', HIDDEN_IN_DASHBOARD),
  violation('production-no-tests', 'infrastructure/uses-tests.ts', HIDDEN_IN_TESTS),
  violation('production-no-tests', 'tests-leak.plugin.ts', HIDDEN_IN_TESTS),
  violation('tenancy-provisioning-entry-restricted', 'infrastructure/uses-provisioning-entry.ts', PROVISIONING_ENTRY),
  violation('tenancy-provisioning-entry-restricted', 'infrastructure/uses-provisioning-package.ts', PROVISIONING_ENTRY),
];

/** `rule | from -> to`, sorted, so a failed comparison names the missing or extra violation. */
export const describeViolations = (violations: readonly ArchitectureViolation[]): string[] =>
  violations.map((entry) => `${entry.rule} | ${entry.from} -> ${entry.to}`).sort();
