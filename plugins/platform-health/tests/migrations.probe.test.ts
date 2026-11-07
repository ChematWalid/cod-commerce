import { describe, expect, it, vi } from 'vitest';
import { MigrationsProbe, PendingMigrationsError } from '../infrastructure/migrations.probe';

/** Postgres' SQLSTATE for "relation does not exist". */
const UNDEFINED_TABLE = '42P01';

/** A data source whose code knows `known`, and whose `query` the test scripts. */
const source = (
  known: string[],
  query: (sql: string) => Promise<unknown>,
  options: { migrationsTableName?: string } = {},
) => ({
  options,
  migrations: known.map((name) => ({ name })),
  query: vi.fn(query),
});

const rows =
  (...names: string[]) =>
  () =>
    Promise.resolve(names.map((name) => ({ name })));

/** 'accepted', or the rejection reason. */
const outcomeOf = (check: Promise<void>): Promise<unknown> =>
  check.then(
    () => 'accepted',
    (error: unknown) => error,
  );

describe('MigrationsProbe', () => {
  it('passes when every code migration has run', async () => {
    const probe = new MigrationsProbe(source(['M1', 'M2'], rows('M1', 'M2')));

    expect(await outcomeOf(probe.check())).toBe('accepted');
  });

  it('fails while a code migration has not run', async () => {
    const probe = new MigrationsProbe(source(['M1', 'M2'], rows('M1')));

    expect(await outcomeOf(probe.check())).toBeInstanceOf(PendingMigrationsError);
  });

  it('reads the migrations table read-only, by its configured name', async () => {
    const data = source(['M1'], rows('M1'), { migrationsTableName: 'schema_migrations' });

    await new MigrationsProbe(data).check();

    expect(data.query).toHaveBeenCalledWith('SELECT "name" FROM "schema_migrations"');
  });

  it('defaults the migrations table to "migrations"', async () => {
    const data = source(['M1'], rows('M1'));

    await new MigrationsProbe(data).check();

    expect(data.query).toHaveBeenCalledWith('SELECT "name" FROM "migrations"');
  });

  it('counts a missing migrations table as pending', async () => {
    const missing = () =>
      Promise.reject(Object.assign(new Error('relation "migrations" does not exist'), { code: UNDEFINED_TABLE }));
    const probe = new MigrationsProbe(source(['M1'], missing));

    expect(await outcomeOf(probe.check())).toBeInstanceOf(PendingMigrationsError);
  });

  it('lets any other query error through', async () => {
    const broken = () => Promise.reject(Object.assign(new Error('permission denied'), { code: '42501' }));
    const probe = new MigrationsProbe(source(['M1'], broken));

    expect(await outcomeOf(probe.check())).toMatchObject({ message: 'permission denied' });
  });

  it('stops querying once no migration is pending', async () => {
    const data = source(['M1'], rows('M1'));
    const probe = new MigrationsProbe(data);

    await probe.check();
    await probe.check();

    expect(data.query).toHaveBeenCalledOnce();
  });
});
