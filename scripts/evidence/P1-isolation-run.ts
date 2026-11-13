// Runs the P1 isolation matrix against the live evidence stack and writes its transcripts and matrix.
//   P1-isolation-run.ts <api base URL> <evidence dir> <work dir>
// Superadmin credentials come from the environment (SUPERADMIN_USERNAME / SUPERADMIN_PASSWORD), never from argv.
// SQL runs through `docker compose exec postgres psql` in the caller's compose project; values are digits only.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ISOLATION_CASES } from '../../apps/server/tests/isolation/cases';
import { IsolationHttp } from '../../apps/server/tests/isolation/http';
import {
  censusTable,
  headingOf,
  matrixTable,
  placeholdersOf,
  transcriptFileOf,
  transcriptOf,
} from '../../apps/server/tests/isolation/report';
import { type Outcome, runMatrix } from '../../apps/server/tests/isolation/run';
import { snapshotOf } from '../../apps/server/tests/isolation/snapshot';
import { type SqlRunner, tenantRowCounts } from '../../apps/server/tests/isolation/tenant-tables';
import { buildWorld } from '../../apps/server/tests/isolation/world';

const [apiUrl, outDir, workDir] = process.argv.slice(2);
if (apiUrl === undefined || outDir === undefined || workDir === undefined) {
  throw new Error('usage: P1-isolation-run.ts <api base URL> <evidence dir> <work dir>');
}
const DIGITS = /^\d+$/;
/** `docker compose` finds the stack's compose file and project from the repository root. */
const ROOT = resolve(__dirname, '../..');

/** One statement through the stack's psql; `$n` parameters must be digits, so nothing can be injected. */
function psql(statement: string, parameters: readonly unknown[] = []): string {
  const sql = statement.replace(/\$(\d+)/g, (_match, index: string) => {
    const value = String(parameters[Number(index) - 1]);
    if (!DIGITS.test(value)) throw new Error(`refusing a non-numeric SQL parameter: ${value}`);
    return `'${value}'`;
  });
  return execFileSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'sh',
      '-c',
      'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$1"',
      '_',
      sql,
    ],
    { encoding: 'utf8', timeout: 30_000, cwd: ROOT },
  ).trim();
}

const sqlRunner: SqlRunner = {
  query: (statement, parameters) => Promise.resolve([{ n: Number(psql(statement, parameters) || '0') }]),
};

async function main(): Promise<void> {
  const http = new IsolationHttp(apiUrl as string);
  const superadmin = {
    username: process.env['SUPERADMIN_USERNAME'] ?? '',
    password: process.env['SUPERADMIN_PASSWORD'] ?? '',
  };
  const password = `isolation-${randomBytes(12).toString('hex')}`;
  const world = await buildWorld({
    http,
    hooks: {
      linkToBusiness: (administratorId, businessId) => {
        psql('UPDATE "administrator" SET "customFieldsBusinessid" = $1 WHERE "id" = $2', [businessId, administratorId]);
        return Promise.resolve();
      },
    },
    superadmin,
    suffix: randomBytes(4).toString('hex'),
    password,
  });
  const census = await tenantRowCounts(sqlRunner, [world.a.businessId, world.b.businessId]);
  const before = { a: await snapshotOf(http, world.a), b: await snapshotOf(http, world.b) };
  const outcomes = await runMatrix(http, world, ISOLATION_CASES);
  const after = { a: await snapshotOf(http, world.a), b: await snapshotOf(http, world.b) };
  const unchanged = JSON.stringify(before) === JSON.stringify(after);
  writeTranscripts(outcomes, placeholdersOf(world));
  writeFileSync(join(outDir as string, 'matrix.md'), `${matrixTable(outcomes)}\n`);
  writeFileSync(join(outDir as string, 'census.md'), `${censusTable(census)}\n`);
  // The screens script signs in as A's owner: its credentials stay in the work dir, which the caller deletes.
  writeFileSync(
    join(workDir as string, 'world.json'),
    JSON.stringify({
      ownerA: { email: world.a.owner.email, password },
      storesA: world.a.stores.map(({ label, subdomain, channelToken, id }) => ({ label, subdomain, channelToken, id })),
      storeB: { id: world.b.stores[0].id, label: world.b.stores[0].label },
      namesA: { stores: ['Store A1', 'Store A2'] },
      namesB: [
        world.b.name,
        'Store B1',
        'Store B2',
        ...world.b.stores.map((store) => store.subdomain),
        world.b.role.name,
        world.b.note.title,
      ],
    }),
  );
  report(outcomes, census, unchanged);
}

function writeTranscripts(outcomes: readonly Outcome[], placeholders: [string, string][]): void {
  mkdirSync(join(outDir as string, 'api'), { recursive: true });
  const byFile = new Map<string, Outcome[]>();
  for (const outcome of outcomes) {
    const file = transcriptFileOf(outcome.case.entity);
    byFile.set(file, [...(byFile.get(file) ?? []), outcome]);
  }
  for (const [file, runs] of byFile) {
    const sections = runs.map((run) => {
      const verdict = run.failures.length === 0 ? 'Pass' : `FAIL: ${run.failures.join('; ')}`;
      const reverse = run.attacker === 'B' ? "Reverse run: B's owner plays A's part and A is the victim. " : '';
      return `### ${headingOf(run)}\n\n${reverse}${run.case.title}. **${verdict}.**\n\n${transcriptOf(run.exchange, placeholders)}\n`;
    });
    const title = `# Isolation: ${runs[0]?.case.entity ?? file}\n\nLive transcripts from \`scripts/evidence/P1-isolation.sh\`. Ids and store tokens are placeholders; sessions are named, never shown.\n\n`;
    writeFileSync(join(outDir as string, 'api', file), `${title}${sections.join('\n')}`);
  }
}

function report(
  outcomes: readonly Outcome[],
  census: Record<string, { a: number; b: number }>,
  unchanged: boolean,
): void {
  const failed = outcomes.filter((outcome) => outcome.failures.length > 0);
  const empty = Object.entries(census).filter(([, { a, b }]) => a === 0 || b === 0);
  console.log(`runs=${String(outcomes.length)} failed=${String(failed.length)} unchanged=${String(unchanged)}`);
  for (const run of failed) console.log(`FAIL ${headingOf(run)}: ${run.failures.join('; ')}`);
  for (const [table] of empty) console.log(`EMPTY ${table}`);
  if (failed.length > 0 || empty.length > 0 || !unchanged) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
