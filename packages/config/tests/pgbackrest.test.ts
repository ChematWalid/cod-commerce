import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const ROOT = resolve(__dirname, '../../..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

interface ComposeService {
  readonly image?: string;
  readonly build?: { readonly context?: string; readonly dockerfile?: string };
  readonly entrypoint?: string[];
  readonly command?: string[];
  readonly environment?: Record<string, string>;
  readonly configs?: { readonly source: string; readonly target: string }[];
  readonly volumes?: string[];
}
interface ComposeFile {
  readonly services: Record<string, ComposeService>;
  readonly configs?: Record<string, { readonly content?: string }>;
  readonly volumes?: Record<string, unknown>;
}

const compose = parse(read('docker-compose.yml'), { merge: true }) as ComposeFile;
const overlay = parse(read('deploy/postgres/compose.yml')) as ComposeFile;
const dockerfile = read('deploy/postgres/Dockerfile');
const example = read('deploy/pgbackrest/pgbackrest.conf.example');
const restoreTest = read('scripts/ops/restore-test.sh');
const lifecycle = read('scripts/ops/garage-lifecycle.sh');
const nightlyDump = read('scripts/ops/nightly-dump.sh');

/** `key=value` lines of an ini file, comments dropped. */
const iniValues = (source: string): Map<string, string> =>
  new Map(
    source
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.includes('=') && !line.startsWith('#'))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)] as const),
  );
/** A script's commands, comments dropped, so a forbidden word in prose does not count. */
const codeOf = (source: string): string =>
  source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');

const R2_HOST = /r2\.cloudflarestorage\.com|r2\.dev/;

describe('the pgBackRest Postgres image (deploy/postgres/Dockerfile)', () => {
  it('builds on the exact Postgres image the data tier runs', () => {
    // Arrange
    const from = /^FROM (\S+)/m.exec(dockerfile)?.[1];

    // Assert
    expect(from).toBe(compose.services['postgres']?.image);
  });

  it('installs one exact pgBackRest package version and drops the apt lists', () => {
    // Assert
    expect(dockerfile).toMatch(/pgbackrest=\d+\.\d+(?:\.\d+)?-\S+/);
    expect(dockerfile).toContain('rm -rf /var/lib/apt/lists/*');
  });
});

describe('WAL archiving in the data tier (docker-compose.yml)', () => {
  const postgres = compose.services['postgres'];
  const start = compose.configs?.['postgres_start_sh']?.content ?? '';

  it('is off unless PGBACKREST_ENABLED is set', () => {
    // Assert
    expect(postgres?.environment?.['COD_WAL_ARCHIVE']).toBe('${PGBACKREST_ENABLED:-false}');
    // pgBackRest reads every PGBACKREST_* variable as an option, so the container never gets this name.
    expect(postgres?.environment).not.toHaveProperty('PGBACKREST_ENABLED');
    expect(start).toMatch(/if \[ "\$\$\{COD_WAL_ARCHIVE:-false\}" = true \]/);
  });

  it('starts through the wrapper, which hands its arguments on to the image entry point', () => {
    // Assert
    expect(postgres?.entrypoint).toEqual(['sh', '/usr/local/bin/cod-postgres-start.sh']);
    expect(postgres?.configs).toContainEqual({
      source: 'postgres_start_sh',
      target: '/usr/local/bin/cod-postgres-start.sh',
    });
    expect(postgres?.command?.[0]).toBe('postgres');
    expect(start).toContain('exec docker-entrypoint.sh "$$@"');
  });

  it('archives through pgBackRest with a bounded WAL age, and refuses to start without the binary', () => {
    // Assert
    expect(start).toContain('archive_mode=on');
    expect(start).toContain('archive_command=pgbackrest --stanza=cod archive-push %p');
    expect(start).toMatch(/archive_timeout=\d+/);
    expect(start).toMatch(/command -v pgbackrest[^\n]*\|\|/);
  });
});

describe('the pgBackRest overlay (deploy/postgres/compose.yml)', () => {
  const postgres = overlay.services['postgres'];
  const conf = iniValues(overlay.configs?.['pgbackrest_conf']?.content ?? '');

  it('builds the pgBackRest image and turns archiving on by default', () => {
    // Assert
    expect(postgres?.build?.context).toBe('deploy/postgres');
    expect(postgres?.image).toMatch(/^cod-postgres:17\.\d+-pgbackrest-\d+\.\d+/);
    expect(postgres?.environment?.['COD_WAL_ARCHIVE']).toBe('${PGBACKREST_ENABLED:-true}');
  });

  it('keeps its repository on a named volume (posix), never on object storage', () => {
    // Assert
    expect(conf.get('repo1-type')).toBe('posix');
    expect(conf.get('repo1-path')).toBe('/var/lib/pgbackrest');
    expect(postgres?.volumes).toContain('pgbackrestrepo:/var/lib/pgbackrest');
    expect(Object.keys(overlay.volumes ?? {})).toContain('pgbackrestrepo');
    expect(conf.get('pg1-path')).toBe('/var/lib/postgresql/data');
  });
});

describe('deploy/pgbackrest/pgbackrest.conf.example', () => {
  const conf = iniValues(example);

  it('sends repo1 to S3 on the second provider and keeps repo2 local (posix)', () => {
    // Assert
    expect(conf.get('repo1-type')).toBe('s3');
    expect(conf.get('repo1-s3-endpoint')).toMatch(/^<.+>$/);
    expect(conf.get('repo2-type')).toBe('posix');
    expect(conf.get('repo1-retention-full')).toMatch(/^\d+$/);
    expect(conf.get('repo2-retention-full')).toMatch(/^\d+$/);
  });

  it('encrypts repo1 and holds no credential or cipher pass (they come from the environment)', () => {
    // Assert
    expect(conf.get('repo1-cipher-type')).toBe('aes-256-cbc');
    for (const key of ['repo1-cipher-pass', 'repo1-s3-key', 'repo1-s3-key-secret']) expect(conf.has(key)).toBe(false);
  });

  it('never points at R2 (ADR 0012: R2 holds public assets only)', () => {
    // Assert
    expect(example).not.toMatch(R2_HOST);
  });
});

describe('scripts/ops/restore-test.sh', () => {
  const code = codeOf(restoreTest);

  it('backs up, switches WAL, then restores twice: to a point in time and to the latest WAL', () => {
    // Assert
    expect(code).toContain('stanza-create');
    expect(code).toContain('--type=full');
    expect(code).toContain('pg_switch_wal()');
    expect(code).toContain('--type=time');
    expect(code).toMatch(/restore_into latest/);
  });

  it('runs on a compose project of its own and removes it, volumes included, on exit', () => {
    // Assert
    expect(code).toMatch(/COMPOSE_PROJECT_NAME=cod-restoretest\b/);
    expect(code).toContain('trap on_exit EXIT');
    expect(code).toContain('down -v --remove-orphans');
    expect(code).not.toMatch(/set -[a-z]*x/);
  });

  it('checks the server against the restored database', () => {
    // Assert
    expect(code).toContain('/readyz');
  });
});

describe('scripts/ops/garage-lifecycle.sh', () => {
  const code = codeOf(lifecycle);

  it('expires uploads/ and exports/ and aborts stale multipart uploads', () => {
    // Assert
    expect(code).toContain('<Prefix>uploads/</Prefix>');
    expect(code).toContain('<Prefix>exports/</Prefix>');
    expect(code).toContain('<AbortIncompleteMultipartUpload>');
  });

  it('only sets lifecycle rules: it creates no key and keeps credentials off the command line', () => {
    // Assert
    expect(code).not.toMatch(/key (create|new|import)/);
    expect(code).toContain('-K -');
    expect(code).not.toMatch(/--user\s+"?\$/);
  });

  it('refuses an R2 endpoint', () => {
    // Assert
    expect(code).toMatch(/\*r2\\?\.cloudflarestorage\.com\*[^\n]*refusing an R2 endpoint/);
  });
});

describe('scripts/ops/nightly-dump.sh', () => {
  const code = codeOf(nightlyDump);

  it('encrypts to a recipient from the environment and never makes a key', () => {
    // Assert
    expect(code).toContain('--recipient "$DUMP_GPG_RECIPIENT"');
    expect(code).not.toMatch(/--(quick-)?gen-key|--full-generate-key|--generate-key/);
  });

  it('refuses an R2 destination and keeps credentials off the command line', () => {
    // Assert
    expect(code).toMatch(/r2\\\.cloudflarestorage/);
    expect(code).toContain('-K -');
  });
});
