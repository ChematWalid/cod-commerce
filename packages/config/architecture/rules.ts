import type { IForbiddenRuleType } from 'dependency-cruiser' with { 'resolution-mode': 'import' };

/** Framework modules that domain code and `@cod/shared` never depend on, resolved or not (CLAUDE.md §3a.1). */
const FRAMEWORK_MODULES = '^(@nestjs|@vendure)/|^typeorm(/|$)|node_modules/(@nestjs|@vendure|typeorm)/';

/** The tenancy entry point that exposes the superadmin context and the unscoped business directory. */
const TENANCY_PROVISIONING_ENTRY = '^plugins/tenancy/provisioning[.]ts$';

/** The platform plugins whose entry points the others may import from infrastructure/ and api/ (D121). */
const PLATFORM_ENTRY =
  '^plugins/(platform-jobs|platform-outbox|platform-partitions|platform-secrets|platform-flags)/index[.]ts$';

/** The rbac entry point that exposes `requirePermission` and nothing else (D58). */
const RBAC_GUARD_ENTRY = '^plugins/rbac/guard[.]ts$';

/** The rbac entry point that exposes member access, grant preview and the suspension check to Team (D206). */
const RBAC_MEMBER_ACCESS_ENTRY = '^plugins/rbac/member-access[.]ts$';

/** The auth entry point that exposes the invited-account service and the email queue to Team (D203, D206). */
const AUTH_INVITATIONS_ENTRY = '^plugins/auth/invitations[.]ts$';

/** The one module of another plugin that a dashboard may import: the merchant shell's page registry (D83). */
const SHELL_API_FILE = 'merchant-shell/$2/shell-api[.]ts';

/** The dashboard files a plugin's entry point may re-export: route paths, test ids and language lists. */
const SERVER_SHARED_DASHBOARD_FILES = 'dashboard/(constants|document-lang)[.]ts$';

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
      'domain/ and application/ stay framework-free: the tenancy, rate-limit and platform entry points export TypeORM and Vendure classes (D121).',
    severity: 'error',
    from: { path: '^plugins/[^/]+/(domain|application)/' },
    to: { path: `^plugins/(tenancy|rate-limit)/index[.]ts$|${PLATFORM_ENTRY}` },
  },
  {
    name: 'no-cross-plugin-internals',
    comment:
      'A plugin never imports another plugin, except the tenancy (D10) and rate-limit (D28) entry points, the platform entry points (D121), the rbac guard entry (D58), the rbac member-access and auth invitations entries (D206), and a dashboard may import the merchant shell\'s shell-api (D83); it uses @cod/shared contracts or domain events. $2 is "dashboard" for a dashboard file and empty otherwise, so only a dashboard matches the shell-api exception.',
    severity: 'error',
    from: { path: '^plugins/([^/]+)/(?:(dashboard)/)?' },
    to: {
      path: '^plugins/[^/]+/',
      pathNot: [
        '^plugins/$1/',
        '^plugins/(tenancy|rate-limit)/index[.]ts$',
        PLATFORM_ENTRY,
        TENANCY_PROVISIONING_ENTRY,
        RBAC_GUARD_ENTRY,
        RBAC_MEMBER_ACCESS_ENTRY,
        AUTH_INVITATIONS_ENTRY,
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
    name: 'production-no-tests',
    comment:
      "Nothing outside a tests/ folder imports a plugin's tests/: the permission and data access gates do not scan it, so code registered from there would pass them.",
    severity: 'error',
    from: { pathNot: '(^|/)tests/' },
    to: { path: '^plugins/[^/]+/tests/' },
  },
  {
    name: 'layers-no-dashboard',
    comment: 'A server layer never imports dashboard/ (ADR 0017): the permission and data access gates do not scan it.',
    severity: 'error',
    from: { path: '^plugins/([^/]+)/(domain|application|infrastructure|api)/' },
    to: { path: '^plugins/$1/dashboard/' },
  },
  {
    name: 'plugin-root-no-dashboard',
    comment:
      "A plugin's root file reaches its dashboard through the path string Vendure compiles, never an import; the one exception is re-exporting the framework-free constants files.",
    severity: 'error',
    from: { path: '^plugins/([^/]+)/[^/]+$' },
    to: { path: '^plugins/$1/dashboard/', pathNot: `^plugins/$1/${SERVER_SHARED_DASHBOARD_FILES}` },
  },
  {
    name: 'dashboard-shared-is-pure',
    comment:
      'The dashboard files an entry point may re-export import no framework and no other plugin file, so nothing else in dashboard/ becomes reachable from server code through them.',
    severity: 'error',
    from: { path: `^plugins/([^/]+)/${SERVER_SHARED_DASHBOARD_FILES}` },
    to: { path: [FRAMEWORK_MODULES, '^plugins/'], pathNot: `^plugins/$1/${SERVER_SHARED_DASHBOARD_FILES}` },
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
    name: 'rbac-guard-entry-api-only',
    comment:
      'The rbac guard entry exports requirePermission, which decorates handlers: outside rbac only an api/ layer may import it (D58).',
    severity: 'error',
    from: { pathNot: ['^plugins/[^/]+/api/', '^plugins/rbac/'] },
    to: { path: RBAC_GUARD_ENTRY },
  },
  {
    name: 'rbac-member-access-entry-infra-only',
    comment:
      "The rbac member-access entry exports Nest services and rbac's module: outside rbac only an adapter (infrastructure/) or a plugin's root *.plugin.ts module file may import it; application/, domain/ and api/ reach it through their own ports (D206).",
    severity: 'error',
    from: { pathNot: ['^plugins/[^/]+/infrastructure/', '^plugins/[^/]+/[^/]+[.]plugin[.]ts$', '^plugins/rbac/'] },
    to: { path: RBAC_MEMBER_ACCESS_ENTRY },
  },
  {
    name: 'auth-invitations-entry-infra-only',
    comment:
      "The auth invitations entry exports Nest services and auth's module: outside auth only an adapter (infrastructure/) or a plugin's root *.plugin.ts module file may import it; application/, domain/ and api/ reach it through their own ports (D206).",
    severity: 'error',
    from: { pathNot: ['^plugins/[^/]+/infrastructure/', '^plugins/[^/]+/[^/]+[.]plugin[.]ts$', '^plugins/auth/'] },
    to: { path: AUTH_INVITATIONS_ENTRY },
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
