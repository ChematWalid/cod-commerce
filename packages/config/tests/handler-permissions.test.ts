import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findUnguardedHandlers, pluginSources } from '../architecture/handler-permissions';

const repoRoot = resolve(__dirname, '../../..');

const scan = (text: string): string[] => findUnguardedHandlers([{ path: 'x.ts', text }]);

describe('handler permissions gate', () => {
  it('finds no unguarded handler under plugins', () => {
    // Arrange
    const sources = pluginSources(repoRoot);

    // Act
    const unguarded = findUnguardedHandlers(sources);

    // Assert: the positive control shows the scan reached the plugins
    expect(sources.some((source) => source.path.endsWith('plugins/rbac/rbac.plugin.ts'))).toBe(true);
    expect(unguarded).toEqual([]);
  });

  it.each([
    ['a query', '@Resolver() class A { @Query() f() {} }', 'x.ts: A.f'],
    ['a mutation', '@Resolver() class A { @Mutation() f() {} }', 'x.ts: A.f'],
    ['a REST route', "@Controller('a') class A { @Get() f() {} }", 'x.ts: A.f'],
    ['an @Allow naming no permission', '@Controller() class A { @Post() @Allow() f() {} }', 'x.ts: A.f'],
    ['a class-level @Allow, which Vendure ignores', '@Allow(P.R) @Resolver() class A { @Query() f() {} }', 'x.ts: A.f'],
  ])('reports %s without a permission', (_name, text, expected) => {
    expect(scan(text)).toEqual([expected]);
  });

  it.each([
    ['an explicit public', '@Controller() class A { @Get() @Allow(Permission.Public) f() {} }'],
    ['requirePermission on the handler', "@Resolver() class A { @Query() @requirePermission('a.b') f() {} }"],
    ['requirePermission on the class', "@requirePermission('a.b') @Resolver() class A { @Query() f() {} }"],
    ['a field resolver', '@Resolver() class A { @ResolveField() f() {} }'],
    ['a helper method', '@Resolver() class A { f() {} }'],
    ['a class that is no handler', 'class A { @Get() f() {} }'],
  ])('accepts %s', (_name, text) => {
    expect(scan(text)).toEqual([]);
  });
});
