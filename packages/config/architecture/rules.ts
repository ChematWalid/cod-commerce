import type { IForbiddenRuleType } from 'dependency-cruiser' with { 'resolution-mode': 'import' };

/** Framework modules that domain code and `@cod/shared` never depend on, resolved or not (CLAUDE.md §3a.1). */
const FRAMEWORK_MODULES = '^(@nestjs|@vendure)/|^typeorm(/|$)|node_modules/(@nestjs|@vendure|typeorm)/';

/** The tenancy entry point that exposes the superadmin context and the unscoped business directory. */
const TENANCY_PROVISIONING_ENTRY = '^plugins/tenancy/provisioning[.]ts$';

/**
 * The dependency rules of CLAUDE.md §3a.1–2, checked by dependency-cruiser.
 * Paths are relative to the cruise `baseDir`; `$1` refers back to the plugin captured in `from`.
 */
export const ARCHITECTURE_RULES: IForbiddenRuleType[] = [
  {
    name: 'domain-is-pure',
    comment: 'domain/ has no Nest, Vendure or TypeORM dependency, type-only imports included.',
    severity: 'error',
    from: { path: '^plugins/[^/]+/domain/' },
    to: { path: FRAMEWORK_MODULES },
  },
  {
    name: 'domain-no-outer-layers',
    comment: 'domain/ depends on nothing but itself.',
    severity: 'error',
    from: { path: '^plugins/([^/]+)/domain/' },
    to: { path: '^plugins/$1/(application|infrastructure|api|dashboard)/' },
  },
  {
    name: 'application-no-concretes',
    comment: 'application/ declares ports; it never reaches the adapters or the API layer.',
    severity: 'error',
    from: { path: '^plugins/([^/]+)/application/' },
    to: { path: '^plugins/$1/(infrastructure|api)/' },
  },
  {
    name: 'api-no-infrastructure',
    comment: 'api/ goes through application/, never straight to the adapters.',
    severity: 'error',
    from: { path: '^plugins/([^/]+)/api/' },
    to: { path: '^plugins/$1/infrastructure/' },
  },
  {
    name: 'plugin-core-no-tenancy-entry',
    comment:
      'domain/ and application/ stay framework-free: the tenancy and rate-limit entry points export TypeORM and Vendure classes.',
    severity: 'error',
    from: { path: '^plugins/[^/]+/(domain|application)/' },
    to: { path: '^plugins/(tenancy|rate-limit)/index[.]ts$' },
  },
  {
    name: 'no-cross-plugin-internals',
    comment:
      'A plugin never imports another plugin, except the tenancy (D10) and rate-limit (D28) entry points; it uses @cod/shared contracts or domain events.',
    severity: 'error',
    from: { path: '^plugins/([^/]+)/' },
    to: {
      path: '^plugins/[^/]+/',
      pathNot: ['^plugins/$1/', '^plugins/(tenancy|rate-limit)/index[.]ts$', TENANCY_PROVISIONING_ENTRY],
    },
  },
  {
    name: 'tenancy-provisioning-entry-restricted',
    comment:
      'The tenancy provisioning entry exports the superadmin context factory and the cross-business directory: only rbac/infrastructure (D56, D57) may import it.',
    severity: 'error',
    from: { pathNot: ['^plugins/rbac/infrastructure/', '^plugins/tenancy/'] },
    to: { path: TENANCY_PROVISIONING_ENTRY },
  },
  {
    name: 'apps-no-plugin-internals',
    comment: 'An app imports a plugin through its entry point, never from its layers.',
    severity: 'error',
    from: { path: '^apps/' },
    to: { path: '^plugins/[^/]+/(domain|application|infrastructure|api|dashboard)/' },
  },
  {
    name: 'shared-is-pure',
    comment: '@cod/shared holds framework-free contracts.',
    severity: 'error',
    from: { path: '^packages/shared/src/' },
    to: { path: FRAMEWORK_MODULES },
  },
  {
    name: 'no-circular',
    comment: 'Circular dependencies hide the dependency direction.',
    severity: 'error',
    from: {},
    to: { circular: true },
  },
];
