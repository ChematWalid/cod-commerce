// @ts-check

/** Every plugin source and the server app; tests, dashboards and generated migrations are not production data paths. */
export const RAW_DATA_GUARDED_FILES = ['**/plugins/*/**', 'apps/server/src/**'];
export const RAW_DATA_UNGUARDED_FILES = [
  '**/plugins/*/tests/**',
  '**/plugins/*/dashboard/**',
  'apps/server/src/migrations/**',
];

/**
 * The files that may reach TypeORM directly (ADR 0002, A7, A10). Any other file goes through `TenantRepository`.
 * `platform-store-lookup` is the unscoped read path and `tenant-transaction` runs only `set_config`. `order-number.service` updates the sequence row, which is keyed by the business itself.
 * Every entry names one file (or the seed folder) and says why; there is no blanket exemption.
 */
export const RAW_DATA_ACCESS_FILES = [
  '**/plugins/tenancy/infrastructure/tenant-repository.ts',
  '**/plugins/tenancy/infrastructure/platform-store-lookup.ts',
  '**/plugins/tenancy/infrastructure/tenant-transaction.ts',
  '**/plugins/tenancy/infrastructure/order-number.service.ts',
  '**/plugins/tenancy/infrastructure/vendure-channel-provisioner.ts',
  // Reads Vendure's account-level `user` row to build the superadmin context (A2).
  '**/plugins/tenancy/infrastructure/superadmin-context.factory.ts',
  // `account_token` is an account-level table, not a tenant one (D24).
  '**/plugins/auth/infrastructure/typeorm-account-token.repository.ts',
  '**/plugins/auth/infrastructure/account-token-purge.task.ts',
  // `session` is Vendure's account-level table, and SessionService has no single-session delete (D22).
  '**/plugins/auth/infrastructure/session-terminator.ts',
  // `administrator` is Vendure's account-level table, and the claim lock runs only an advisory lock (D41).
  '**/plugins/auth/infrastructure/vendure-account-identity.ts',
  '**/plugins/auth/infrastructure/email-claim-lock.ts',
  // The profile reads and writes the same account-level `administrator` row.
  '**/plugins/auth/infrastructure/vendure-account-profile.ts',
  // `authentication_method` and `user` are Vendure's account-level tables (D36).
  '**/plugins/auth/infrastructure/vendure-external-identity.ts',
  // `administrator` is Vendure's account-level table; every read carries the caller's business.
  '**/plugins/rbac/infrastructure/vendure-actor-directory.ts',
  // Runs only the advisory lock (D70).
  '**/plugins/rbac/infrastructure/rbac-lock.ts',
  // `session` and `administrator` are Vendure's account-level tables (D55).
  '**/plugins/rbac/infrastructure/role-session-flusher.ts',
  // Hands the raw connection to the two readiness probes below; it runs no query itself.
  '**/plugins/platform-health/platform-health.plugin.ts',
  // Runs only `SELECT 1`: no table at all.
  '**/plugins/platform-health/infrastructure/postgres.probe.ts',
  // Reads only TypeORM's migrations table, which holds no tenant row.
  '**/plugins/platform-health/infrastructure/migrations.probe.ts',
  // Seeds write platform rows (zone, tax, default channel, superadmin, demo accounts) before any tenant exists.
  'apps/server/src/seed/**',
  // Takes only the migration advisory lock on a `pg` client; it reads no table.
  'apps/server/src/roles/migrate.role.ts',
];

export const RAW_DATA_ACCESS_MESSAGE =
  'Tenant tables are reached only through TenantRepository or tenantQuery (ADR 0002)';

/** Members of a TypeORM `DataSource`/`EntityManager` or Vendure `TransactionalConnection` that reach any table. */
const RAW_MEMBERS = [
  'getRepository',
  'rawConnection',
  'manager',
  'createQueryBuilder',
  'createQueryRunner',
  'getEntityOrThrow',
  'findOneInChannel',
  'findByIdsInChannel',
].join('|');
const RAW_MEMBER = `/^(${RAW_MEMBERS})$/`;
/** Receivers whose `query()` is raw SQL. `TenantRepository.query(scope, alias)` is the scoped one and stays allowed. */
const SQL_RECEIVER = '/^(ds|dataSource|connection|rawConnection|manager|entityManager|queryRunner)$/i';
const QUERY_CALL = "CallExpression[callee.property.name='query']";

const RAW_DATA_SELECTORS = [
  // connection.getRepository(...), connection['rawConnection'], connection[`rawConnection`]
  `MemberExpression[property.name=${RAW_MEMBER}]`,
  `MemberExpression[computed=true][property.value=${RAW_MEMBER}]`,
  `MemberExpression[computed=true] > TemplateLiteral.property > TemplateElement[value.cooked=${RAW_MEMBER}]`,
  // const { rawConnection } = connection; const { 'getRepository': repositoryOf } = connection;
  `ObjectPattern > Property[key.name=${RAW_MEMBER}]`,
  `ObjectPattern > Property[key.value=${RAW_MEMBER}]`,
  // dataSource.query(SQL), this.ds.query(SQL), anything.query('select …'), anything.query(`select …`)
  `${QUERY_CALL}[callee.object.name=${SQL_RECEIVER}]`,
  `${QUERY_CALL}[callee.object.property.name=${SQL_RECEIVER}]`,
  `${QUERY_CALL}[arguments.0.type=/^(Literal|TemplateLiteral)$/]`,
];

/** `no-restricted-syntax` entries of the data access gate, to merge with a file group's other entries. */
export const RAW_DATA_SYNTAX = RAW_DATA_SELECTORS.map((selector) => ({ selector, message: RAW_DATA_ACCESS_MESSAGE }));

/** `no-restricted-imports` paths of the data access gate: the injectables that hand out an unscoped connection. */
export const RAW_DATA_IMPORT_PATHS = [
  { name: 'typeorm', importNames: ['DataSource', 'EntityManager', 'Connection'], message: RAW_DATA_ACCESS_MESSAGE },
  {
    name: '@nestjs/typeorm',
    importNames: ['InjectDataSource', 'InjectRepository', 'InjectEntityManager', 'InjectConnection'],
    message: RAW_DATA_ACCESS_MESSAGE,
  },
];

/**
 * The data access gate (CLAUDE.md §3a.9). A flat config block REPLACES the options of a rule set by an earlier block,
 * so this block comes before the framework-free ones, which carry {@link RAW_DATA_SYNTAX} beside their own entries.
 */
export const rawDataAccessConfig = {
  files: RAW_DATA_GUARDED_FILES,
  ignores: [...RAW_DATA_UNGUARDED_FILES, ...RAW_DATA_ACCESS_FILES],
  rules: {
    'no-restricted-syntax': ['error', ...RAW_DATA_SYNTAX],
    'no-restricted-imports': ['error', { paths: RAW_DATA_IMPORT_PATHS }],
  },
};
