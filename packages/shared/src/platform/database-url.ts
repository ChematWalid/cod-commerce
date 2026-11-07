/** The connection fields of a Postgres URL, decoded. */
export interface PostgresFields {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

/** A database URL that cannot be read as `postgres(ql)://user:password@host:port/database`. The message never contains the URL. */
export class InvalidDatabaseUrlError extends Error {
  constructor(reason: string) {
    super(`Invalid database URL: ${reason}`);
    this.name = 'InvalidDatabaseUrlError';
  }
}

const POSTGRES_PROTOCOLS = ['postgres:', 'postgresql:'];
const DEFAULT_POSTGRES_PORT = 5432;
const DATABASE_NAME = /^[A-Za-z0-9_]+$/;
const PORT_DIGITS = /^\d+$/;

function parseUrl(url: string): URL {
  try {
    return new URL(url);
  } catch {
    throw new InvalidDatabaseUrlError('it is not a URL (a reserved character in the password must be percent-encoded)');
  }
}

function decode(part: string, label: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    throw new InvalidDatabaseUrlError(`the ${label} has an invalid percent-encoding`);
  }
}

function requireNonEmpty(value: string, label: string): string {
  if (value === '') {
    throw new InvalidDatabaseUrlError(`the ${label} is empty`);
  }
  return value;
}

/** Connection options in a query string or a fragment would be dropped by the field split, so neither is accepted. */
function rejectQueryAndFragment(parsed: URL, url: string): void {
  // `URL.search` and `URL.hash` are empty for a bare `?` or `#`, so the raw URL is checked as well.
  if (parsed.search !== '' || url.includes('?')) {
    throw new InvalidDatabaseUrlError('it has a query string; connection options in the URL are not supported');
  }
  if (parsed.hash !== '' || url.includes('#')) {
    throw new InvalidDatabaseUrlError(
      'it has a fragment (a reserved character in the password must be percent-encoded)',
    );
  }
}

function readPort(port: string): number {
  if (port === '') {
    return DEFAULT_POSTGRES_PORT;
  }
  if (!PORT_DIGITS.test(port)) {
    throw new InvalidDatabaseUrlError('the port is not numeric');
  }
  return Number(port);
}

/**
 * Splits a Postgres URL into decoded connection fields, for drivers that take fields rather than a URL.
 * A reserved character left unencoded in the password (`@`, `/`, `#`, `:`) shifts the URL's parts, so
 * such a URL is rejected instead of being read as a different host or database. A query string or a
 * fragment is rejected too, since the fields could not carry it (e.g. `?sslmode=require`).
 *
 * @throws {InvalidDatabaseUrlError} when the URL is not a well-formed Postgres URL.
 */
export function toPostgresFields(url: string): PostgresFields {
  const parsed = parseUrl(url);
  if (!POSTGRES_PROTOCOLS.includes(parsed.protocol)) {
    throw new InvalidDatabaseUrlError('the scheme is not postgres or postgresql');
  }
  rejectQueryAndFragment(parsed, url);
  const database = decode(parsed.pathname.slice(1), 'database name');
  if (!DATABASE_NAME.test(database)) {
    throw new InvalidDatabaseUrlError(
      'the database name must be a single path segment of letters, digits and underscores',
    );
  }
  return {
    host: requireNonEmpty(parsed.hostname, 'host'),
    port: readPort(parsed.port),
    username: requireNonEmpty(decode(parsed.username, 'user'), 'user'),
    password: requireNonEmpty(decode(parsed.password, 'password'), 'password'),
    database,
  };
}
