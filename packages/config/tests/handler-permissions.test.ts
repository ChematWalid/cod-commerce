import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findUnguardedHandlers, pluginSources } from '../architecture/handler-permissions';

const repoRoot = resolve(__dirname, '../../..');
const fixtureRoot = join(__dirname, 'fixtures/handlers');

/** The real guards: the gate resolves a decorator through the file's imports, so a look-alike never counts. */
const VENDURE = "import { Allow, Permission } from '@vendure/core';";
const RBAC = "import { requirePermission } from '@cod/plugin-rbac';";
const LOCAL_GUARD = 'function requirePermission(key: string): MethodDecorator { return () => { void key; }; }';

const RELATIVE_GUARD_USE = "@Resolver() class A { @Query() @requirePermission('a.b') f() {} }";

const scan = (text: string): string[] => findUnguardedHandlers([{ path: 'x.ts', text }]);

describe('handler permissions gate', () => {
  it('finds no unguarded handler under plugins', () => {
    // Arrange
    const sources = pluginSources(repoRoot);

    // Act
    const unguarded = findUnguardedHandlers(sources);

    // Assert: the positive controls show the scan reached the plugins and a nested api folder
    expect(sources.some((source) => source.path.endsWith('plugins/rbac/rbac.plugin.ts'))).toBe(true);
    expect(sources.some((source) => source.path.endsWith('plugins/rbac/api/roles.resolver.ts'))).toBe(true);
    expect(unguarded).toEqual([]);
  });

  it('skips dashboard and tests only as direct children of a plugin', () => {
    // Arrange
    const sources = pluginSources(fixtureRoot);

    // Act
    const unguarded = findUnguardedHandlers(sources);

    // Assert
    expect(unguarded.sort()).toEqual([
      'plugins/x/api/dashboard/stats.resolver.ts: StatsResolver.stats',
      'plugins/x/api/tests/probe.resolver.ts: ProbeResolver.probe',
    ]);
    expect(sources.map((source) => source.path)).toContain('plugins/x/api/guarded.resolver.ts');
  });

  it.each([
    ['a query', '@Resolver() class A { @Query() f() {} }', 'x.ts: A.f'],
    ['a mutation', '@Resolver() class A { @Mutation() f() {} }', 'x.ts: A.f'],
    ['a REST route', "@Controller('a') class A { @Get() f() {} }", 'x.ts: A.f'],
    ['an @Allow naming no permission', `${VENDURE} @Controller() class A { @Post() @Allow() f() {} }`, 'x.ts: A.f'],
    [
      'a class-level @Allow, which Vendure ignores',
      `${VENDURE} @Allow(Permission.Public) @Resolver() class A { @Query() f() {} }`,
      'x.ts: A.f',
    ],
    ['a server-sent events route', "@Controller() class A { @Sse('x') f() {} }", 'x.ts: A.f'],
    ['a SEARCH route', '@Controller() class A { @Search() f() {} }', 'x.ts: A.f'],
    [
      'an aliased decorator',
      "import { Query as GqlQuery, Resolver as R } from '@nestjs/graphql'; @R() class A { @GqlQuery() f() {} }",
      'x.ts: A.f',
    ],
    [
      'a namespaced decorator',
      "import * as gql from '@nestjs/graphql'; @gql.Resolver() class A { @gql.Query() f() {} }",
      'x.ts: A.f',
    ],
    ['a handler on a class with no handler decorator', 'class A { @Get() f() {} }', 'x.ts: A.f'],
    ['an inherited handler', 'class Base { @Mutation() f() {} } @Resolver() class A extends Base {}', 'x.ts: Base.f'],
    [
      'a class declared inside a function',
      'function make() { @Resolver() class A { @Query() f() {} } return A; }',
      'x.ts: A.f',
    ],
    ['a class expression', 'export const A = class { @Query() f() {} };', 'x.ts: A.f'],
    [
      'an empty @Allow listed before requirePermission: decorators apply bottom-up, so the empty one wins',
      `${VENDURE} ${RBAC} @Resolver() class A { @Query() @Allow() @requirePermission('a.b') f() {} }`,
      'x.ts: A.f',
    ],
    [
      'an empty @Allow listed before the one that names a permission',
      `${VENDURE} @Resolver() class A { @Query() @Allow() @Allow(Permission.Owner) f() {} }`,
      'x.ts: A.f',
    ],
    ['a spread @Allow', `${VENDURE} @Resolver() class A { @Query() @Allow(...[]) f() {} }`, 'x.ts: A.f'],
    ['a property handler', '@Resolver() class A { @Query() f = () => 1; }', 'x.ts: A.f'],
    [
      'a file-local requirePermission',
      `${LOCAL_GUARD} @Resolver() class A { @Query() @requirePermission('a.b') f() {} }`,
      'x.ts: A.f',
    ],
    [
      'a file-local requirePermission on the class',
      `${LOCAL_GUARD} @requirePermission('a.b') @Resolver() class A { @Query() f() {} }`,
      'x.ts: A.f',
    ],
    [
      'an @Allow that is not Vendure`s',
      "import { Allow } from './allow'; @Resolver() class A { @Query() @Allow('a') f() {} }",
      'x.ts: A.f',
    ],
    ['an @Allow imported from nowhere', "@Resolver() class A { @Query() @Allow('a') f() {} }", 'x.ts: A.f'],
    [
      'an empty @Allow under a class-level requirePermission, which the empty one wins at runtime',
      `${VENDURE} ${RBAC} @requirePermission('a.b') @Resolver() class A { @Query() @Allow() f() {} }`,
      'x.ts: A.f',
    ],
    [
      'a property handler under a class-level requirePermission, which guards prototype methods only',
      `${RBAC} @requirePermission('a.b') @Resolver() class A { @Query() f = () => 1; }`,
      'x.ts: A.f',
    ],
  ])('reports %s without a permission', (_name, text, expected) => {
    expect(scan(text)).toEqual([expected]);
  });

  it.each(['plugins/rbac/api/roles.resolver.ts', 'plugins/rbac/api/nested/roles.resolver.ts'])(
    'accepts requirePermission imported by path from its own file, in %s',
    (path) => {
      const specifier = path.includes('nested') ? '../require-permission.decorator' : './require-permission.decorator';
      const text = `import { requirePermission } from '${specifier}'; ${RELATIVE_GUARD_USE}`;

      expect(findUnguardedHandlers([{ path, text }])).toEqual([]);
    },
  );

  it.each(['plugins/evil/api/a.resolver.ts', 'plugins/rbac/infrastructure/a.resolver.ts', 'x.ts'])(
    'reports a look-alike ./require-permission.decorator in %s',
    (path) => {
      const text = `import { requirePermission } from './require-permission.decorator'; ${RELATIVE_GUARD_USE}`;

      expect(findUnguardedHandlers([{ path, text }])).toEqual([`${path}: A.f`]);
    },
  );

  it.each([
    ['an explicit public', `${VENDURE} @Controller() class A { @Get() @Allow(Permission.Public) f() {} }`],
    [
      'an @Allow with no @TenantScoped (D85)',
      `${VENDURE} @Resolver() class A { @Mutation() @Allow(Permission.Owner) f() {} }`,
    ],
    [
      'an aliased @Allow',
      "import { Allow as Can, Permission } from '@vendure/core'; @Resolver() class A { @Query() @Can(Permission.Public) f() {} }",
    ],
    [
      'a namespaced @Allow',
      "import * as core from '@vendure/core'; @Resolver() class A { @Query() @core.Allow(core.Permission.Public) f() {} }",
    ],
    ['requirePermission on the handler', `${RBAC} @Resolver() class A { @Query() @requirePermission('a.b') f() {} }`],
    ['requirePermission on the class', `${RBAC} @requirePermission('a.b') @Resolver() class A { @Query() f() {} }`],
    [
      'an empty @Allow listed after the @Allow that names a permission, which is applied last and wins',
      `${VENDURE} @Resolver() class A { @Query() @Allow(Permission.Owner) @Allow() f() {} }`,
    ],
    [
      'an empty @Allow listed after requirePermission, which is applied last and wins',
      `${VENDURE} ${RBAC} @Resolver() class A { @Query() @requirePermission('a.b') @Allow() f() {} }`,
    ],
    [
      'a handler naming its own permission under a class-level requirePermission',
      `${VENDURE} ${RBAC} @requirePermission('a.b') @Resolver() class A { @Query() @Allow(Permission.Public) f() {} }`,
    ],
    ['a field resolver', '@Resolver() class A { @ResolveField() f() {} }'],
    ['a helper method', '@Resolver() class A { f() {} }'],
  ])('accepts %s', (_name, text) => {
    expect(scan(text)).toEqual([]);
  });
});
