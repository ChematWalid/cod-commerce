import type { IForbiddenRuleType } from 'dependency-cruiser' with { 'resolution-mode': 'import' };

/** Framework modules that domain code and `@cod/shared` never depend on, resolved or not (CLAUDE.md §3a.1). */
const FRAMEWORK_MODULES = '^(@nestjs|@vendure)/|^typeorm(/|$)|node_modules/(@nestjs|@vendure|typeorm)/';

/** The tenancy entry point that exposes the superadmin context and the unscoped business directory. */
const TENANCY_PROVISIONING_ENTRY = '^plugins/tenancy/provisioning[.]ts$';

/** The one module of another plugin that a dashboard may import: the merchant shell's page registry (D83). */
const SHELL_API_FILE = 'merchant-shell/$2/shell-api[.]ts';

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
    name: 'application-is-pure',
    comment: 'application/ holds plain classes behind ports: no Nest, Vendure or TypeORM, type-only imports included.',
    severity: 'error',
    from: { path: '^plugins/[^/]+/application/' },
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
      'A plugin never imports another plugin, except the tenancy (D10) and rate-limit (D28) entry points, and a dashboard may import the merchant shell\'s shell-api (D83); it uses @cod/shared contracts or domain events. $2 is "dashboard" for a dashboard file and empty otherwise, so only a dashboard matches the shell-api exception.',
    severity: 'error',
    from: { path: '^plugins/([^/]+)/(?:(dashboard)/)?' },
    to: {
      path: '^plugins/[^/]+/',
      pathNot: [
        '^plugins/$1/',
        '^plugins/(tenancy|rate-limit)/index[.]ts$',
        TENANCY_PROVISIONING_ENTRY,
        `^plugins/${SHELL_API_FILE}$`,
      ],
    },
  },
  {
    name: 'dashboard-no-plugin-core',
    comment:
      "dashboard/ holds presentation only (ADR 0017, D92): it never imports its plugin's domain, application, infrastructure or api.",
    severity: 'error',
    from: { path: '^plugins/([^/]+)/dashboard/' },
    to: { path: '^plugins/$1/(domain|application|infrastructure|api)/' },
  },
  {
    name: 'dashboard-no-server-entry',
    comment:
      "dashboard/ imports no server layer (ADR 0017, D92): never a plugin's entry point or provisioning entry, its own included. The merchant shell's shell-api stays the one cross-plugin import (D83).",
    severity: 'error',
    from: { path: '^plugins/[^/]+/dashboard/' },
    to: { path: '^plugins/[^/]+/(index|provisioning)[.]ts$' },
  },
  {
    name: 'layers-no-own-entry',
    comment:
      "A layer never imports its own plugin's root files (entry point, Nest module), by path or through the package name: they import every layer.",
    severity: 'error',
    from: { path: '^plugins/([^/]+)/(domain|application|infrastructure|api|dashboard)/' },
    to: { path: '^plugins/$1/[^/]+[.]ts$' },
  },
  {
    name: 'no-unresolved-workspace-import',
    comment:
      'Every rule here matches resolved paths, so a @cod/* import that the cruise cannot resolve would be checked by none of them.',
    severity: 'error',
    from: { path: '^(apps|plugins)/' },
    to: { path: '^@cod/', couldNotResolve: true },
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
